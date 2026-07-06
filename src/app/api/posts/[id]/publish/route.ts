import { NextResponse } from "next/server";
import { publishPost } from "@/lib/publish";

// 承認済みの投稿を今すぐ公開する
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await publishPost(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
