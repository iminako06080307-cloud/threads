// ============================================================
// 公式LINE誘導のCTA (Call To Action) 生成
//
// LINE_CTA_URL が設定されているとき、投稿の最後に付ける
// 「公式LINEへ誘導する連投」を組み立てる。
// ============================================================

const DEFAULT_MESSAGE = `＼ここまで読んでくれたあなたへ／
無理なく続ける「増やさない習慣」のまとめを公式LINEでお渡ししてます🎁
気になる人は受け取ってね👇
{url}`;

// LINE誘導が有効か
export function isLineCtaEnabled(): boolean {
  return !!process.env.LINE_CTA_URL?.trim();
}

// 誘導用の連投テキストを返す。無効なら null。
export function buildLineCta(): string | null {
  const url = process.env.LINE_CTA_URL?.trim();
  if (!url) return null;
  const template = process.env.LINE_CTA_MESSAGE?.trim() || DEFAULT_MESSAGE;
  // {url} が無ければ末尾に付ける
  const text = template.includes("{url}")
    ? template.replaceAll("{url}", url)
    : `${template}\n${url}`;
  return text;
}
