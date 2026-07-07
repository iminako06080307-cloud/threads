import { NextResponse } from "next/server";
import { checkThreadsConnection } from "@/lib/threads";
import { ctaStatus } from "@/lib/cta";

// 各種連携の設定状況・接続確認
export async function GET() {
  const anthropic = !!process.env.ANTHROPIC_API_KEY;
  const threadsConfigured =
    !!process.env.THREADS_USER_ID && !!process.env.THREADS_ACCESS_TOKEN;

  const threads = threadsConfigured
    ? await checkThreadsConnection()
    : { ok: false, error: "未設定" };

  const cta = ctaStatus();

  return NextResponse.json({
    anthropic: { configured: anthropic },
    threads: { configured: threadsConfigured, ...threads },
    instagramCta: { configured: cta.instagram },
    lineCta: { configured: cta.line },
  });
}
