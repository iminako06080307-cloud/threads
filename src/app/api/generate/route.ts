import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateDietContent } from "@/lib/anthropic";

const schema = z.object({
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
      formatId: input.formatId,
      topic: input.topic,
    });

    const post = await prisma.post.create({
      data: {
        format: input.formatId,
        topic: input.topic,
        text: content.text,
        thread: JSON.stringify(content.thread),
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
