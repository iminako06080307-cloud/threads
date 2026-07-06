import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 下書き一覧 (新しい順)
export async function GET() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ posts });
}
