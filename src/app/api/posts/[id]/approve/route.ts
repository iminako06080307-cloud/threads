import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  // approve: 承認して(必要なら)予約, reject: 却下
  action: z.enum(["approve", "reject"]),
  // 予約時刻(ISO文字列)。未指定の承認は「即時投稿待ち」= APPROVED のまま
  scheduledAt: z.string().datetime().nullable().optional(),
});

// 下書きを承認 / 予約 / 却下する
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  if (body.action === "reject") {
    const post = await prisma.post.update({
      where: { id },
      data: { status: "REJECTED", scheduledAt: null },
    });
    return NextResponse.json({ post });
  }

  // approve
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const post = await prisma.post.update({
    where: { id },
    data: {
      status: scheduledAt ? "SCHEDULED" : "APPROVED",
      scheduledAt,
      errorMessage: null,
    },
  });
  return NextResponse.json({ post });
}
