"use client";

import { useEffect, useState } from "react";
import { DIET_FORMATS, DIET_STYLES } from "@/lib/prompts/diet";

type Post = {
  id: string;
  style: string;
  format: string;
  topic: string;
  text: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き",
  APPROVED: "承認済み",
  SCHEDULED: "予約済み",
  PUBLISHING: "投稿中",
  PUBLISHED: "投稿済み",
  FAILED: "失敗",
  REJECTED: "却下",
};

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [styleId, setStyleId] = useState(DIET_STYLES[0].id);
  const [formatId, setFormatId] = useState(DIET_FORMATS[0].id);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/posts");
    const data = await res.json();
    setPosts(data.posts ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId, formatId, topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");
      setTopic("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }

  const selectedFormat = DIET_FORMATS.find((f) => f.id === formatId);
  const selectedStyle = DIET_STYLES.find((s) => s.id === styleId);

  return (
    <div>
      <h1>ダイエット投稿を生成</h1>
      <p className="subtitle">
        フォーマットとお題を選んでAIに下書きを作らせ、確認して承認・予約投稿します。
      </p>

      <div className="card">
        <label htmlFor="style">発信スタイル (声)</label>
        <select
          id="style"
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
        >
          {DIET_STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {selectedStyle && (
          <p className="post-meta" style={{ marginTop: 6 }}>
            {selectedStyle.description}
          </p>
        )}

        <div className="row" style={{ marginTop: 4 }}>
          <div>
            <label htmlFor="format">フォーマット</label>
            <select
              id="format"
              value={formatId}
              onChange={(e) => setFormatId(e.target.value)}
            >
              {DIET_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            {selectedFormat && (
              <p className="post-meta" style={{ marginTop: 6 }}>
                {selectedFormat.description}
                {selectedFormat.bestStyle === styleId && " ◎このスタイルと好相性"}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="topic">お題・テーマ (任意)</label>
            <input
              id="topic"
              value={topic}
              placeholder="例: 夜遅い食事でも太りにくくするコツ"
              onChange={(e) => setTopic(e.target.value)}
            />
            <p className="post-meta" style={{ marginTop: 6 }}>
              空欄なら鉄板テーマをAIが選びます。
            </p>
          </div>
        </div>

        {error && <div className="notice err">{error}</div>}

        <div className="btn-row">
          <button onClick={generate} disabled={loading}>
            {loading ? (
              <>
                <span className="spin">⏳</span> 生成中…
              </>
            ) : (
              "AIで下書きを生成"
            )}
          </button>
        </div>
      </div>

      <h2>下書き・投稿一覧</h2>
      {posts.length === 0 ? (
        <div className="empty">まだ投稿がありません。上のフォームから生成しましょう。</div>
      ) : (
        posts.map((p) => (
          <div className="card" key={p.id}>
            <div className="post-item">
              <div style={{ minWidth: 0 }}>
                <a className="title" href={`/posts/${p.id}`}>
                  {DIET_FORMATS.find((f) => f.id === p.format)?.label ?? p.format}
                  {p.topic ? ` — ${p.topic}` : ""}
                </a>
                <div className="post-meta">
                  {p.text.slice(0, 60)}
                  {p.text.length > 60 ? "…" : ""}
                </div>
                {p.scheduledAt && (
                  <div className="post-meta">
                    予約: {new Date(p.scheduledAt).toLocaleString("ja-JP")}
                  </div>
                )}
              </div>
              <span className={`badge ${p.status}`}>
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
