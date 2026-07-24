"use client";

import { useEffect, useState } from "react";
import {
  DIET_FORMATS,
  DIET_STYLES,
  DEFAULT_STYLE_ID,
  DEFAULT_FORMAT_ID,
  SOURCE_FORMATS,
} from "@/lib/prompts/diet";

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
  const [styleId, setStyleId] = useState(DEFAULT_STYLE_ID);
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT_ID);
  const [topic, setTopic] = useState("");
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function uploadFile(file: File) {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アップロードに失敗しました");
      setMediaUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードエラー");
    } finally {
      setUploading(false);
    }
  }

  const needsSource = SOURCE_FORMATS.includes(formatId);

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
        body: JSON.stringify({ styleId, formatId, topic, sourceMaterial, mediaUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");
      setTopic("");
      setSourceMaterial("");
      setMediaUrl("");
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

        {needsSource && (
          <>
            <label htmlFor="source" style={{ marginTop: 4 }}>
              実際の素材（お客様の声／サポート生さんの取り組みを貼る）
            </label>
            <textarea
              id="source"
              value={sourceMaterial}
              placeholder="本人からもらったお礼メッセージや、実際に取り組んだ内容・変化をそのまま貼ってください。&#10;AIはこの内容に忠実に整えます（結果や数字は創作しません）。"
              onChange={(e) => setSourceMaterial(e.target.value)}
            />
            <div className="notice warn" style={{ marginTop: 8 }}>
              ⚠️ 掲載には<strong>本人の同意</strong>が必要です（写真・文章とも）。末尾に「※個人の感想です。効果には個人差があります」を自動で付けます。誇大・医学的な効果表現は避けてください。勉強会の「席に限りがある」等は事実の範囲で書いてください。
            </div>
          </>
        )}

        <label htmlFor="mediaFile" style={{ marginTop: 4 }}>
          画像（任意・ビフォアフ等）
        </label>
        <input
          id="mediaFile"
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />
        {uploading && (
          <p className="post-meta" style={{ marginTop: 6 }}>
            <span className="spin">⏳</span> アップロード中…
          </p>
        )}
        {mediaUrl && !uploading && (
          <div style={{ marginTop: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl}
              alt="プレビュー"
              style={{ maxWidth: 180, borderRadius: 8, border: "1px solid var(--border)" }}
            />
            <button
              className="danger"
              style={{ display: "block", marginTop: 6, padding: "2px 10px", fontSize: 12 }}
              onClick={() => setMediaUrl("")}
            >
              画像を外す
            </button>
          </div>
        )}
        <p className="post-meta" style={{ marginTop: 6 }}>
          画像を付けると画像付き投稿になります。ビフォアフ写真は本人同意＋加工なしで。
          URLを直接使いたい場合は下に貼ってもOK。
        </p>
        <input
          value={mediaUrl}
          placeholder="または画像URLを直接貼る（https://...）"
          onChange={(e) => setMediaUrl(e.target.value)}
        />

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
