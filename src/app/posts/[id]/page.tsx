"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DIET_FORMATS, DIET_STYLES, THREADS_MAX_CHARS } from "@/lib/prompts/diet";

type Post = {
  id: string;
  style: string;
  format: string;
  topic: string;
  text: string;
  thread: string;
  hashtags: string;
  mediaUrl: string | null;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  permalink: string | null;
  errorMessage: string | null;
};

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [post, setPost] = useState<Post | null>(null);
  const [text, setText] = useState("");
  const [thread, setThread] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadFile(file: File) {
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アップロードに失敗しました");
      setMediaUrl(data.url);
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "アップロードエラー" });
    } finally {
      setUploading(false);
    }
  }

  // 手動投稿用: テキストをクリップボードにコピー
  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      setMsg({ kind: "err", text: "コピーできませんでした（ブラウザの許可を確認）" });
    }
  }

  async function load() {
    const res = await fetch(`/api/posts/${id}`);
    const data = await res.json();
    const p: Post = data.post;
    setPost(p);
    setText(p.text);
    setHashtags(p.hashtags);
    setMediaUrl(p.mediaUrl ?? "");
    try {
      setThread(JSON.parse(p.thread));
    } catch {
      setThread([]);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, thread, hashtags, mediaUrl: mediaUrl || null }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setMsg({ kind: "ok", text: "保存しました" });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "エラー" });
    } finally {
      setBusy(false);
    }
  }

  async function approve(withSchedule: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      await save();
      const body: Record<string, unknown> = { action: "approve" };
      if (withSchedule) {
        if (!scheduledAt) throw new Error("予約日時を指定してください");
        body.scheduledAt = new Date(scheduledAt).toISOString();
      }
      const res = await fetch(`/api/posts/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "承認に失敗しました");
      }
      setMsg({
        kind: "ok",
        text: withSchedule ? "予約しました" : "承認しました",
      });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "エラー" });
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/posts/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ kind: "ok", text: "却下しました" });
      load();
    }
  }

  async function publishNow() {
    if (!confirm("今すぐThreadsに投稿します。よろしいですか？")) return;
    setBusy(true);
    setMsg(null);
    try {
      await save();
      // 投稿前に必ず承認済みにする(下書き・失敗・却下からの再投稿にも対応)
      await fetch(`/api/posts/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const res = await fetch(`/api/posts/${id}/publish`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "投稿に失敗しました");
      setMsg({ kind: "ok", text: "投稿しました！" });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "エラー" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("この投稿案を削除しますか？")) return;
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (!post) return <div className="empty">読み込み中…</div>;

  const formatLabel =
    DIET_FORMATS.find((f) => f.id === post.format)?.label ?? post.format;
  const styleLabel =
    DIET_STYLES.find((s) => s.id === post.style)?.label ?? post.style;
  const editable =
    post.status === "DRAFT" ||
    post.status === "APPROVED" ||
    post.status === "REJECTED" ||
    post.status === "FAILED";
  const overLimit = text.length > THREADS_MAX_CHARS;

  return (
    <div>
      <a href="/" className="post-meta">
        ← 一覧へ戻る
      </a>
      <h1 style={{ marginTop: 10 }}>
        {formatLabel}{" "}
        <span className={`badge ${post.status}`} style={{ fontSize: 13 }}>
          {post.status}
        </span>
      </h1>
      <p className="subtitle">
        スタイル: {styleLabel}
        {post.topic ? ` ・ お題: ${post.topic}` : ""}
      </p>

      {post.permalink && (
        <div className="notice ok">
          投稿済み →{" "}
          <a href={post.permalink} target="_blank" rel="noreferrer">
            Threadsで見る
          </a>
        </div>
      )}
      {post.errorMessage && (
        <div className="notice err">エラー: {post.errorMessage}</div>
      )}

      <div className="notice warn">
        📋 手動投稿モード：各投稿の「コピー」を押して、Threadsアプリに貼り付けて投稿できます（メイン投稿→連投の順に返信）。
      </div>

      <div className="card">
        <label>メイン投稿</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!editable}
        />
        <div
          className="post-meta"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span style={{ color: overLimit ? "var(--danger)" : undefined }}>
            {text.length} / {THREADS_MAX_CHARS} 文字
          </span>
          <button
            className="secondary"
            style={{ padding: "4px 12px", fontSize: 12 }}
            onClick={() =>
              copy("main", hashtags.trim() ? `${text}\n\n${hashtags}` : text)
            }
          >
            {copied === "main" ? "✓ コピーしました" : "メイン投稿をコピー"}
          </button>
        </div>

        <label style={{ marginTop: 16 }}>連投 (スレッド)</label>
        {thread.length === 0 && (
          <p className="post-meta">連投はありません。</p>
        )}
        {thread.map((t, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <textarea
              value={t}
              disabled={!editable}
              onChange={(e) => {
                const next = [...thread];
                next[i] = e.target.value;
                setThread(next);
              }}
              style={{ minHeight: 80 }}
            />
            <div className="post-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span
                style={{ color: t.length > THREADS_MAX_CHARS ? "var(--danger)" : undefined }}
              >
                {i + 2}件目 · {t.length} / {THREADS_MAX_CHARS} 文字
              </span>
              <span style={{ display: "flex", gap: 8 }}>
                <button
                  className="secondary"
                  style={{ padding: "2px 10px", fontSize: 12 }}
                  onClick={() => copy(`t${i}`, t)}
                >
                  {copied === `t${i}` ? "✓ コピー済" : "コピー"}
                </button>
                {editable && (
                  <button
                    className="danger"
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => setThread(thread.filter((_, j) => j !== i))}
                  >
                    削除
                  </button>
                )}
              </span>
            </div>
          </div>
        ))}
        {editable && (
          <button
            className="secondary"
            onClick={() => setThread([...thread, ""])}
            style={{ marginTop: 4 }}
          >
            + 連投を追加
          </button>
        )}

        <label style={{ marginTop: 16 }}>ハッシュタグ</label>
        <input
          value={hashtags}
          disabled={!editable}
          onChange={(e) => setHashtags(e.target.value)}
        />

        <label style={{ marginTop: 16 }}>画像（任意・ビフォアフ等）</label>
        {editable && (
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
            }}
          />
        )}
        {uploading && (
          <p className="post-meta">
            <span className="spin">⏳</span> アップロード中…
          </p>
        )}
        <input
          value={mediaUrl}
          disabled={!editable}
          placeholder="または画像URLを直接貼る（https://...）"
          onChange={(e) => setMediaUrl(e.target.value)}
          style={{ marginTop: 8 }}
        />
        {mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt="添付画像プレビュー"
            style={{
              maxWidth: "100%",
              marginTop: 10,
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
      </div>

      {msg && <div className={`notice ${msg.kind}`}>{msg.text}</div>}

      {editable && (
        <div className="card">
          <div className="btn-row">
            <button className="secondary" onClick={save} disabled={busy}>
              下書き保存
            </button>
            <button onClick={() => approve(false)} disabled={busy || overLimit}>
              承認 (投稿待ち)
            </button>
            <button onClick={publishNow} disabled={busy || overLimit}>
              今すぐ投稿
            </button>
          </div>

          <label style={{ marginTop: 18 }}>予約投稿の日時</label>
          <div className="row">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <button onClick={() => approve(true)} disabled={busy || overLimit}>
              この日時で予約
            </button>
          </div>

          <div className="btn-row">
            <button className="danger" onClick={reject} disabled={busy}>
              却下
            </button>
            <button className="danger" onClick={remove} disabled={busy}>
              削除
            </button>
          </div>
        </div>
      )}

      {!editable && (
        <div className="btn-row">
          <button className="danger" onClick={remove} disabled={busy}>
            削除
          </button>
        </div>
      )}
    </div>
  );
}
