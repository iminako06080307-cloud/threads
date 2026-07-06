import { prisma } from "./db";
import { publishToThreads } from "./threads";

// 指定した投稿をThreadsへ公開する。成功/失敗をDBに反映する。
// API(即時投稿)とスケジューラ(予約投稿)の両方から使う共通処理。
export async function publishPost(id: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return { ok: false, error: "投稿が見つかりません" };

  if (post.status === "PUBLISHED") {
    return { ok: false, error: "すでに投稿済みです" };
  }
  if (post.status !== "APPROVED" && post.status !== "SCHEDULED") {
    return { ok: false, error: "承認済みの投稿のみ公開できます" };
  }

  // 二重投稿防止のため PUBLISHING に遷移
  await prisma.post.update({
    where: { id },
    data: { status: "PUBLISHING", errorMessage: null },
  });

  try {
    const thread: string[] = safeParseArray(post.thread);
    const result = await publishToThreads({
      text: post.text,
      thread,
      hashtags: post.hashtags,
      mediaUrl: post.mediaUrl ?? undefined,
    });

    await prisma.post.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        threadsPostId: result.threadsPostId,
        permalink: result.permalink,
      },
    });
    await prisma.publishLog.create({
      data: {
        postId: id,
        level: "info",
        message: `投稿成功: ${result.permalink ?? result.threadsPostId}`,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "投稿に失敗しました";
    await prisma.post.update({
      where: { id },
      data: { status: "FAILED", errorMessage: message },
    });
    await prisma.publishLog.create({
      data: { postId: id, level: "error", message },
    });
    return { ok: false, error: message };
  }
}

function safeParseArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
