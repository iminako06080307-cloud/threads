import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateDietContent } from "@/lib/anthropic";
import { buildCtas } from "@/lib/cta";

const schema = z.object({
  styleId: z.string().min(1).default("EXPERT"),
  formatId: z.string().min(1),
  topic: z.string().default(""),
});

export async function POST(req: Request) {
  let input;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  try {
    const content = await generateDietContent({
      styleId: input.styleId,
      formatId: input.formatId,
      topic: input.topic,
    });

    // Instagram / 公式LINE 誘導が設定されていれば、連投の最後にCTAを追加
    const thread = [...content.thread, ...buildCtas()];

    const post = await prisma.post.create({
      data: {
        style: input.styleId,
        format: input.formatId,
        topic: input.topic,
        text: content.text,
        thread: JSON.stringify(thread),
        hashtags: content.hashtags,
        status: "DRAFT",
      },
    });

    return NextResponse.json({ post });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
