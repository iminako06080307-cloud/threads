import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ダイエット投稿 自動生成システム",
  description: "AIでダイエット系Instagram投稿を生成・承認・予約投稿",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <header className="app-header">
          <div className="wrap">
            <a href="/" className="brand">
              🥗 ダイエット投稿ジェネレーター
            </a>
            <nav>
              <a href="/">下書き一覧</a>
              <a href="/settings">接続状態</a>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
