import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateDietContent } from "@/lib/anthropic";
import { buildCtas, buildLeadMagnetCta } from "@/lib/cta";
import { TESTIMONIAL_DISCLAIMER } from "@/lib/prompts/diet";

const schema = z.object({
  styleId: z.string().min(1).default("EXPERT"),
  formatId: z.string().min(1),
  topic: z.string().default(""),
  // お客様の声フォーマット用: 本人からもらった本物のメッセージ
  sourceMaterial: z.string().optional(),
  // ビフォアフ等の画像URL (公開URL。Threadsが取得できる必要あり)
  mediaUrl: z.string().url().optional().or(z.literal("")),
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
      sourceMaterial: input.sourceMaterial,
    });

    // 連投を組み立て
    const thread = [...content.thread];
    if (input.formatId === "TESTIMONIAL") {
      thread.push(TESTIMONIAL_DISCLAIMER);
    }
    if (input.formatId === "LEAD_MAGNET") {
      // 特典配布投稿は本文が既に特典紹介なので、受け取りURLだけ足す(誘導CTAの重複を避ける)
      const cta = buildLeadMagnetCta();
      if (cta) thread.push(cta);
    } else {
      thread.push(...buildCtas());
    }

    const post = await prisma.post.create({
      data: {
        style: input.styleId,
        format: input.formatId,
        topic: input.topic,
        text: content.text,
        thread: JSON.stringify(thread),
        hashtags: content.hashtags,
        mediaUrl: input.mediaUrl || null,
        status: "DRAFT",
      },
    });

    return NextResponse.json({ post });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
