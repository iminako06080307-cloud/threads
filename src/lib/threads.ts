// ============================================================
// Threads API (Content Publishing) 連携
//
// フロー:
//   1. メディアコンテナ作成 (TEXT / IMAGE)  POST /{user}/threads
//   2. 公開                                 POST /{user}/threads_publish
//   3. 連投は reply_to_id に直前の投稿IDを指定して繰り返す
//
// 前提: Threadsアカウント + OAuthで取得した長期アクセストークン
//       (scope: threads_basic, threads_content_publish)。詳細は README 参照。
//   https://developers.facebook.com/docs/threads/posts
// ============================================================

const API_VERSION = process.env.THREADS_API_VERSION || "v1.0";
const BASE = `https://graph.threads.net/${API_VERSION}`;

type ThreadsConfig = {
  userId: string;
  accessToken: string;
};

function getConfig(): ThreadsConfig {
  const userId = process.env.THREADS_USER_ID;
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  if (!userId || !accessToken) {
    throw new Error(
      "THREADS_USER_ID / THREADS_ACCESS_TOKEN が未設定です。.env を確認してください。"
    );
  }
  return { userId, accessToken };
}

async function threadsPost(
  path: string,
  params: Record<string, string>,
  accessToken: string
): Promise<any> {
  const body = new URLSearchParams({ ...params, access_token: accessToken });
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Threads API エラー: ${json.error?.message ?? res.statusText}`);
  }
  return json;
}

async function threadsGet(
  path: string,
  params: Record<string, string>,
  accessToken: string
): Promise<any> {
  const query = new URLSearchParams({ ...params, access_token: accessToken });
  const res = await fetch(`${BASE}/${path}?${query}`);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Threads API エラー: ${json.error?.message ?? res.statusText}`);
  }
  return json;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Threadsで一時的に起きうる（少し待てば直る）エラーかどうか
function isTransient(msg: string): boolean {
  return /does not exist|requested resource|not available|Media ID|try again|temporarily/i.test(
    msg
  );
}

// 一時エラーの間は待って再試行する
async function retryTransient<T>(
  fn: () => Promise<T>,
  attempts = 5,
  delayMs = 2500
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!isTransient(msg) || i === attempts - 1) throw e;
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

// コンテナが公開可能(FINISHED)になるまで待つ
async function waitForContainerReady(
  cfg: ThreadsConfig,
  creationId: string,
  maxAttempts: number
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await threadsGet(
        creationId,
        { fields: "status" },
        cfg.accessToken
      );
      if (res.status === "FINISHED") return;
      if (res.status === "ERROR" || res.status === "EXPIRED") {
        throw new Error(`メディア処理に失敗しました (${res.status})`);
      }
    } catch (e) {
      // 反映前は取得自体が一時エラーになることがあるので待って再試行
      const msg = e instanceof Error ? e.message : String(e);
      if (!isTransient(msg)) throw e;
    }
    await sleep(2000);
  }
  // タイムアウトしても公開自体は試す(FINISHEDが取れなくても公開できる場合がある)
}

// 1件のThreads投稿を作成→公開し、そのメディアIDを返す。
async function createAndPublish(
  cfg: ThreadsConfig,
  params: {
    text: string;
    mediaUrl?: string;
    replyToId?: string;
  }
): Promise<string> {
  const containerParams: Record<string, string> = {};
  if (params.mediaUrl) {
    containerParams.media_type = "IMAGE";
    containerParams.image_url = params.mediaUrl;
    if (params.text) containerParams.text = params.text;
  } else {
    containerParams.media_type = "TEXT";
    containerParams.text = params.text;
  }
  if (params.replyToId) containerParams.reply_to_id = params.replyToId;

  // 1. コンテナ作成 (連投で前の投稿が未反映のことがあるので一時エラーは再試行)
  const created = await retryTransient(() =>
    threadsPost(`${cfg.userId}/threads`, containerParams, cfg.accessToken)
  );
  const creationId = created.id as string;

  // 2. 公開可能になるまで待つ (画像は長め)
  await waitForContainerReady(cfg, creationId, params.mediaUrl ? 30 : 10);

  // 3. 公開 (一時エラーは待って再試行)
  const published = await retryTransient(() =>
    threadsPost(
      `${cfg.userId}/threads_publish`,
      { creation_id: creationId },
      cfg.accessToken
    )
  );
  return published.id as string;
}

// アップロード画像(/uploads/..)を Threads が取得できる公開URLに変換する。
// 既に http(s) の絶対URLならそのまま返す。
function resolvePublicUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.PUBLIC_BASE_URL?.trim();
  if (!base) {
    throw new Error(
      "アップロードした画像を自動投稿するには PUBLIC_BASE_URL (アプリの公開URL) の設定が必要です。" +
        "手動投稿の場合は、画像をThreadsアプリで直接添付してください。"
    );
  }
  return `${base.replace(/\/$/, "")}${url}`;
}

export type ThreadsPublishInput = {
  text: string; // メイン投稿本文
  thread?: string[]; // 連投 (2件目以降)
  hashtags?: string; // メイン投稿末尾に付与
  mediaUrl?: string; // 任意の画像
};

export type ThreadsPublishResult = {
  threadsPostId: string; // メイン投稿ID
  permalink?: string;
};

// メイン投稿 + 連投チェーンを順に公開する。
export async function publishToThreads(
  input: ThreadsPublishInput
): Promise<ThreadsPublishResult> {
  const cfg = getConfig();

  const mainText = [input.text, input.hashtags?.trim()]
    .filter(Boolean)
    .join("\n\n");

  if (!mainText.trim()) {
    throw new Error("投稿本文が空です。");
  }

  // メイン投稿 (アップロード画像は公開URLに解決してから渡す)
  const mainId = await createAndPublish(cfg, {
    text: mainText,
    mediaUrl: input.mediaUrl ? resolvePublicUrl(input.mediaUrl) : undefined,
  });

  // 連投 (直前の投稿へのリプライとして連鎖)
  let previousId = mainId;
  for (const reply of input.thread ?? []) {
    if (!reply.trim()) continue;
    // 直前の投稿が反映されるまで少し待つ (連投の安定化)
    await sleep(1500);
    previousId = await createAndPublish(cfg, {
      text: reply,
      replyToId: previousId,
    });
  }

  // permalink 取得 (失敗しても投稿は成功しているので握りつぶす)
  let permalink: string | undefined;
  try {
    const info = await threadsGet(mainId, { fields: "permalink" }, cfg.accessToken);
    permalink = info.permalink;
  } catch {
    /* noop */
  }

  return { threadsPostId: mainId, permalink };
}

// 接続確認 (プロフィール情報を取得できるか)
export async function checkThreadsConnection(): Promise<{
  ok: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const cfg = getConfig();
    const res = await threadsGet(
      cfg.userId,
      { fields: "username,threads_profile_picture_url" },
      cfg.accessToken
    );
    return { ok: true, username: res.username };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
