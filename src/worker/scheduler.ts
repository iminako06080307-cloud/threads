// ============================================================
// 予約投稿ワーカー
//
// SCHEDULED かつ scheduledAt が現在時刻を過ぎた投稿を拾ってThreadsへ公開する。
// 実行: npm run worker   (常駐プロセスとして動かす)
// ============================================================
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// tsx実行時は.envを自動で読まないので、依存なしで最小限ロードする
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    console.warn("[worker] .env が読み込めませんでした。環境変数から取得します。");
  }
}

loadEnv();

// env をセットしてから import する (PrismaやSDKが初期化時にenvを読むため)
async function main() {
  const { prisma } = await import("../lib/db");
  const { publishPost } = await import("../lib/publish");

  const intervalSec = Number(process.env.SCHEDULER_INTERVAL_SECONDS || "60");
  console.log(`[worker] 予約投稿ワーカー開始 (${intervalSec}秒間隔)`);

  async function tick() {
    const now = new Date();
    const due = await prisma.post.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lte: now } },
      orderBy: { scheduledAt: "asc" },
      take: 5, // 一度に処理する上限 (レート制限に配慮)
    });

    for (const post of due) {
      console.log(`[worker] 投稿処理: ${post.id} (${post.format})`);
      const result = await publishPost(post.id);
      console.log(
        result.ok
          ? `[worker] ✅ 成功: ${post.id}`
          : `[worker] ❌ 失敗: ${post.id} — ${result.error}`
      );
    }
  }

  // 初回即実行 → 以降はインターバル
  await tick().catch((e) => console.error("[worker] tick error:", e));
  setInterval(() => {
    tick().catch((e) => console.error("[worker] tick error:", e));
  }, intervalSec * 1000);
}

main().catch((e) => {
  console.error("[worker] 起動失敗:", e);
  process.exit(1);
});
