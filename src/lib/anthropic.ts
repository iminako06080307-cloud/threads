import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildGenerationPrompt } from "./prompts/diet";

const DEFAULT_MODEL = "claude-sonnet-5";

export type GeneratedContent = {
  text: string;
  thread: string[];
  hashtags: string;
};

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY が未設定です。.env に設定してください。");
  }
  return new Anthropic({ apiKey });
}

// JSONブロックを安全に抜き出す (モデルが前後に文字を足した場合の保険)
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return text.trim();
}

export async function generateDietContent(params: {
  styleId: string;
  formatId: string;
  topic: string;
  sourceMaterial?: string;
}): Promise<GeneratedContent> {
  const client = getClient();
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const message = await client.messages.create({
    model,
    max_tokens: 2000,
    system: buildSystemPrompt(params.styleId),
    messages: [
      {
        role: "user",
        content: buildGenerationPrompt({
          formatId: params.formatId,
          topic: params.topic,
          sourceMaterial: params.sourceMaterial,
        }),
      },
    ],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error("生成結果のJSON解析に失敗しました。もう一度お試しください。");
  }

  const obj = parsed as Partial<GeneratedContent>;
  return {
    text: typeof obj.text === "string" ? obj.text : "",
    thread: Array.isArray(obj.thread)
      ? obj.thread.filter((t): t is string => typeof t === "string" && t.trim() !== "")
      : [],
    hashtags: typeof obj.hashtags === "string" ? obj.hashtags : "",
  };
}
