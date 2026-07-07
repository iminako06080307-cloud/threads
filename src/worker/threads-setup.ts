// ============================================================
// Threads 接続セットアップ補助
//
// Metaダッシュボードで発行した「短期アクセストークン」と「アプリシークレット」から、
//   1. 長期アクセストークン(60日有効)への変換
//   2. ユーザーID・ユーザー名の取得
// をまとめて行い、.env に貼る値を出力する。
//
// 使い方:
//   npm run threads:setup -- --token=短期トークン --secret=アプリシークレット
// ============================================================

const API = "https://graph.threads.net";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const shortToken = getArg("token") || process.env.THREADS_SHORT_TOKEN;
  const secret = getArg("secret") || process.env.THREADS_APP_SECRET;

  if (!shortToken || !secret) {
    console.error(
      [
        "❌ 引数が足りません。",
        "",
        "使い方:",
        "  npm run threads:setup -- --token=短期トークン --secret=アプリシークレット",
        "",
        "・短期トークン: Metaの Threads ユースケース設定の「アクセストークンを生成」で取得",
        "・アプリシークレット: アプリ設定 → ベーシック → app secret（「表示」を押す）",
      ].join("\n")
    );
    process.exit(1);
  }

  // 1. 長期トークンへ変換
  console.log("⏳ 長期トークンへ変換中...");
  const exUrl = new URL(`${API}/access_token`);
  exUrl.searchParams.set("grant_type", "th_exchange_token");
  exUrl.searchParams.set("client_secret", secret);
  exUrl.searchParams.set("access_token", shortToken);

  const exRes = await fetch(exUrl);
  const exJson = await exRes.json();
  if (!exRes.ok || exJson.error) {
    console.error("❌ 長期トークンへの変換に失敗:", exJson.error?.message ?? exJson);
    process.exit(1);
  }
  const longToken: string = exJson.access_token;
  const expiresDays = exJson.expires_in
    ? Math.round(exJson.expires_in / 86400)
    : "?";

  // 2. ユーザーID取得
  console.log("⏳ ユーザー情報を取得中...");
  const meUrl = new URL(`${API}/v1.0/me`);
  meUrl.searchParams.set("fields", "id,username");
  meUrl.searchParams.set("access_token", longToken);

  const meRes = await fetch(meUrl);
  const meJson = await meRes.json();
  if (!meRes.ok || meJson.error) {
    console.error("❌ ユーザー情報の取得に失敗:", meJson.error?.message ?? meJson);
    process.exit(1);
  }

  console.log("\n✅ 成功！ 以下の2行を .env に貼ってください（既存の行は置き換え）:\n");
  console.log(`THREADS_USER_ID="${meJson.id}"`);
  console.log(`THREADS_ACCESS_TOKEN="${longToken}"`);
  console.log(
    `\n（接続アカウント: @${meJson.username} / トークン有効期限: 約${expiresDays}日）`
  );
  console.log("貼って保存したら、アプリを再起動して /settings で「接続OK」を確認してください。");
}

main().catch((e) => {
  console.error("予期せぬエラー:", e);
  process.exit(1);
});
