"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DIET_FORMATS, THREADS_MAX_CHARS } from "@/lib/prompts/diet";

type Post = {
  id: string;
  format: string;
  topic: string;
  text: string;
  thread: string;
  hashtags: string;
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
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  async function load() {
    const res = await fetch(`/api/posts/${id}`);
    const data = await res.json();
    const p: Post = data.post;
    setPost(p);
    setText(p.text);
    setHashtags(p.hashtags);
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
        body: JSON.stringify({ text, thread, hashtags }),
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
      // 承認されていなければ先に承認する
      if (post && post.status === "DRAFT") {
        await fetch(`/api/posts/${id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        });
      }
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
      {post.topic && <p className="subtitle">お題: {post.topic}</p>}

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

      <div className="card">
        <label>メイン投稿</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!editable}
        />
        <div
          className="post-meta"
          style={{ color: overLimit ? "var(--danger)" : undefined }}
        >
          {text.length} / {THREADS_MAX_CHARS} 文字
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
            <div className="post-meta" style={{ display: "flex", justifyContent: "space-between" }}>
              <span
                style={{ color: t.length > THREADS_MAX_CHARS ? "var(--danger)" : undefined }}
              >
                {i + 2}件目 · {t.length} / {THREADS_MAX_CHARS} 文字
              </span>
              {editable && (
                <button
                  className="danger"
                  style={{ padding: "2px 10px", fontSize: 12 }}
                  onClick={() => setThread(thread.filter((_, j) => j !== i))}
                >
                  削除
                </button>
              )}
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
