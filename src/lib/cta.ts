// ============================================================
// 誘導CTA (Call To Action) 生成
//
// 投稿の最後に付ける「別チャネルへの誘導」を組み立てる。
//   - Instagram誘導 … IG_USERNAME もしくは IG_CTA_URL を設定
//   - 公式LINE誘導  … LINE_CTA_URL を設定
// どちらも設定すれば両方、片方だけでも可。未設定なら付かない。
// ============================================================

const DEFAULT_IG_MESSAGE = `＼もっと知りたい人へ／
毎日の献立や"増やさない"習慣は、インスタでも発信してます📸
フォローはこちら👇
{url}`;

const DEFAULT_LINE_MESSAGE = `＼最後まで読んでくれたあなたへ／
公式LINEで、この2つを無料プレゼント中です🎁
✅「まごわやさしい」が簡単にそろう食材リスト
✅50代でも痩せられる！習慣リスト
受け取りは👇
{url}`;

// テンプレートに URL を差し込む ({url} が無ければ末尾に付ける)
function applyTemplate(template: string, url: string): string {
  return template.includes("{url}")
    ? template.replaceAll("{url}", url)
    : `${template}\n${url}`;
}

// Instagram誘導テキスト。無効なら null。
export function buildInstagramCta(): string | null {
  const urlEnv = process.env.IG_CTA_URL?.trim();
  const username = process.env.IG_USERNAME?.trim();
  const url =
    urlEnv ||
    (username
      ? `https://www.instagram.com/${username.replace(/^@/, "")}`
      : "");
  if (!url) return null;
  const template = process.env.IG_CTA_MESSAGE?.trim() || DEFAULT_IG_MESSAGE;
  return applyTemplate(template, url);
}

// LINE誘導テキスト。無効なら null。
export function buildLineCta(): string | null {
  const url = process.env.LINE_CTA_URL?.trim();
  if (!url) return null;
  const template = process.env.LINE_CTA_MESSAGE?.trim() || DEFAULT_LINE_MESSAGE;
  return applyTemplate(template, url);
}

// 設定されている誘導CTAをまとめて返す (Instagram → LINE の順)。
export function buildCtas(): string[] {
  return [buildInstagramCta(), buildLineCta()].filter(
    (x): x is string => !!x
  );
}

// 各誘導の設定状況
export function ctaStatus(): { instagram: boolean; line: boolean } {
  return {
    instagram: buildInstagramCta() !== null,
    line: buildLineCta() !== null,
  };
}
