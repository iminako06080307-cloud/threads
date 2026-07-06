"use client";

import { useEffect, useState } from "react";

type Status = {
  anthropic: { configured: boolean };
  threads: { configured: boolean; ok?: boolean; username?: string; error?: string };
};

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>接続状態</h1>
      <p className="subtitle">
        各種APIの設定状況です。値は <code>.env</code> で設定します。
      </p>

      {loading || !status ? (
        <div className="empty">確認中…</div>
      ) : (
        <>
          <div className="card">
            <div className="post-item">
              <div>
                <div className="title">Claude API (コンテンツ生成)</div>
                <div className="post-meta">ANTHROPIC_API_KEY</div>
              </div>
              <span
                className={`badge ${status.anthropic.configured ? "PUBLISHED" : "FAILED"}`}
              >
                {status.anthropic.configured ? "設定済み" : "未設定"}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="post-item">
              <div>
                <div className="title">Threads API (投稿)</div>
                <div className="post-meta">
                  THREADS_USER_ID / THREADS_ACCESS_TOKEN
                </div>
                {status.threads.username && (
                  <div className="post-meta">
                    接続アカウント: @{status.threads.username}
                  </div>
                )}
                {status.threads.configured && status.threads.error && (
                  <div className="post-meta" style={{ color: "var(--danger)" }}>
                    {status.threads.error}
                  </div>
                )}
              </div>
              <span
                className={`badge ${
                  status.threads.ok
                    ? "PUBLISHED"
                    : status.threads.configured
                    ? "FAILED"
                    : "DRAFT"
                }`}
              >
                {status.threads.ok
                  ? "接続OK"
                  : status.threads.configured
                  ? "エラー"
                  : "未設定"}
              </span>
            </div>
          </div>

          <div className="notice warn">
            設定手順は README を参照してください。トークン取得後、
            <code>.env</code> に記入してアプリを再起動すると反映されます。
          </div>
        </>
      )}
    </div>
  );
}
