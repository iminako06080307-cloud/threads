import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: { logs: { orderBy: { createdAt: "desc" } } },
  });
  if (!post) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ post });
}

const patchSchema = z.object({
  text: z.string().optional(),
  thread: z.array(z.string()).optional(),
  hashtags: z.string().optional(),
  mediaUrl: z.string().nullable().optional(),
});

// 下書きの本文・連投・タグを編集する
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.text !== undefined) data.text = body.text;
  if (body.thread !== undefined) data.thread = JSON.stringify(body.thread);
  if (body.hashtags !== undefined) data.hashtags = body.hashtags;
  if (body.mediaUrl !== undefined) data.mediaUrl = body.mediaUrl;

  const post = await prisma.post.update({ where: { id }, data });
  return NextResponse.json({ post });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
