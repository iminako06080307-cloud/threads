// ============================================================
// ダイエットジャンル特化の生成プロンプト定義 (Threads / テキスト中心)
//
// ここを編集すればAIの生成スタイル・投稿フォーマットを調整できます。
// ユーザーの「やりたい型」が決まったら FORMATS に追記/上書きしてください。
// ============================================================

// Threadsの1投稿あたりの文字数上限
export const THREADS_MAX_CHARS = 500;

export type DietFormat = {
  id: string;
  label: string; // 管理画面に表示する名前
  description: string; // どんな投稿か
  // 生成AIへの追加指示 (この型ならではの構成ルール)
  structure: string;
  // 連投(スレッド)にする場合の目安件数。1ならメイン投稿のみ。
  threadCount: number;
};

export const DIET_FORMATS: DietFormat[] = [
  {
    id: "HABITS",
    label: "痩せる習慣リスト",
    description: "今日から真似できる習慣を紹介する保存されやすい型",
    structure: [
      "メイン投稿: 数字入りの強いフックで始める (例『痩せ体質になる習慣、まとめました🧵』)。冒頭で結論を出し、最初の1〜2個の習慣まで書く。",
      "連投: 1件につき習慣1つ。短い見出し的な一文 + 具体的な理由/実践方法を数行。",
      "最後の連投: ひとことまとめ + 保存・フォローを促すCTA。",
    ].join("\n"),
    threadCount: 5,
  },
  {
    id: "NG_FOODS",
    label: "NG食品・落とし穴紹介",
    description: "太りやすい食品や勘違いされがちなヘルシー食品を暴露する型",
    structure: [
      "メイン投稿: 意外性のあるフック (例『実は太る“ヘルシー”食品、正直に言います』)。",
      "連投: 1件1食品。なぜNGか + 代わりのおすすめを添える。",
      "最後の連投: まとめ + CTA。",
    ].join("\n"),
    threadCount: 5,
  },
  {
    id: "MEAL_LOG",
    label: "1日の食事例",
    description: "リアルな食事例を朝昼晩+間食で見せて工夫を解説する型",
    structure: [
      "メイン投稿: 数字で結果訴求 (例『-5kgした人の1日の食事、公開します』)。",
      "連投: 朝食/昼食/間食/夕食 各1件。メニュー + ポイント + ざっくりカロリー。",
      "最後の連投: 合計と続けるコツ + CTA。",
    ].join("\n"),
    threadCount: 6,
  },
  {
    id: "BEFORE_AFTER",
    label: "ビフォーアフター / 実績訴求",
    description: "変化のストーリーと、そこで効いた行動を分解して伝える型",
    structure: [
      "メイン投稿: 変化幅のフック (例『3ヶ月で見た目が変わった理由、話します』)。",
      "連投: 変化の要因を『やめたこと』『始めたこと』に分けて紹介。",
      "最後の連投: 読者が今日できる一歩 + CTA。",
    ].join("\n"),
    threadCount: 5,
  },
];

export function getFormat(id: string): DietFormat {
  return DIET_FORMATS.find((f) => f.id === id) ?? DIET_FORMATS[0];
}

// 全フォーマット共通の下地となるジャンル方針
export const DIET_SYSTEM_PROMPT = `あなたはダイエット・ボディメイク系Threadsアカウントを運用するプロのライターです。
日本語で、フォロワーが「保存・いいね」したくなる価値の高いテキスト投稿を作ります。

Threadsの特性:
- 1投稿は${THREADS_MAX_CHARS}文字まで。超えそうな内容は連投(スレッド)に分割する。
- 会話的で本音っぽい、親しみやすいトーンが好まれる (Instagramより口語寄り)。
- 過度な絵文字・ハッシュタグの詰め込みは避ける (タグは付けても1〜3個)。

必ず守るルール:
- 医療的・断定的すぎる表現や、極端な断食・危険な減量を推奨しない。健康的で持続可能な内容にする。
- 誇大広告や虚偽の効果保証をしない (「絶対」「必ず痩せる」等は避ける)。
- 専門用語は噛み砕き、初心者にもわかる言葉で書く。
- 各投稿は最初の一文で心をつかむ。冗長にしない。`;

// 生成をJSONで返させるための指示 + 出力スキーマ
export function buildGenerationPrompt(params: {
  formatId: string;
  topic: string;
}): string {
  const format = getFormat(params.formatId);
  const topicLine = params.topic.trim()
    ? `お題・テーマ: ${params.topic.trim()}`
    : "お題: おまかせ (このフォーマットで反応が良さそうな鉄板テーマを自分で選ぶ)";

  return `${topicLine}
フォーマット: ${format.label} — ${format.description}

このフォーマットの構成ルール:
${format.structure}

上記に沿って、メイン投稿1件 + 連投${format.threadCount - 1}件程度のスレッドを作ってください。
各投稿は必ず${THREADS_MAX_CHARS}文字以内。
必ず次のJSONのみを出力してください (前後に説明文やコードブロックの記号を付けない):

{
  "text": "メイン投稿の本文 (フックから始める。${THREADS_MAX_CHARS}文字以内)",
  "thread": ["連投2件目の本文", "連投3件目の本文", "..."],
  "hashtags": "#ダイエット #痩せる のように1〜3個 (任意)"
}`;
}
