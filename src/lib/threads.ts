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

  // 1. コンテナ作成
  const created = await threadsPost(
    `${cfg.userId}/threads`,
    containerParams,
    cfg.accessToken
  );
  const creationId = created.id as string;

  // 画像は処理に少し時間がかかるため、公開前に短く待つ (推奨)
  if (params.mediaUrl) {
    await new Promise((r) => setTimeout(r, 3000));
  }

  // 2. 公開
  const published = await threadsPost(
    `${cfg.userId}/threads_publish`,
    { creation_id: creationId },
    cfg.accessToken
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
