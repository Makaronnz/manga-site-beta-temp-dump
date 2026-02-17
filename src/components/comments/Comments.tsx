// src/components/comments/Comments.tsx
"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type CommentItem = {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
  user_profiles?: { username?: string | null; avatar_url?: string | null } | null;
};

export default function Comments({ seriesId, chapterId }: { seriesId?: number; chapterId?: number }) {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const load = async () => {
    const qs = new URLSearchParams();
    if (seriesId) qs.set("seriesId", String(seriesId));
    if (chapterId) qs.set("chapterId", String(chapterId));
    const r = await fetch(`/api/comments?${qs.toString()}`);
    const j = await r.json();
    setItems(j.items || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, chapterId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const r = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: text.trim(),
        seriesId: seriesId || null,
        chapterId: chapterId || null,
      }),
    });
    setBusy(false);
    if (r.ok) {
      setText("");
      load();
    } else {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "You need to login to comment.");
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this comment?")) return;
    const r = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (r.ok) {
      setItems((prev) => prev.filter((x) => x.id !== id));
    } else {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "Failed to delete.");
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold mb-3">Comments</h2>

      <form onSubmit={submit} className="flex gap-2 mb-4">
        <input
          className="flex-1 rounded px-3 py-2 bg-white/5"
          placeholder="Write a comment..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button disabled={busy} className="px-4 py-2 rounded bg-white/10 hover:bg-white/20">
          Post
        </button>
      </form>

      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id} className="rounded bg-white/5 p-3">
            <div className="text-sm opacity-70 flex items-center justify-between">
              <span>
                {c.user_profiles?.username || c.user_id.slice(0, 6)} • {new Date(c.created_at).toLocaleString()}
              </span>
              {me && c.user_id === me && (
                <button
                  onClick={() => del(c.id)}
                  className="text-red-300 hover:text-red-200 text-xs ml-3"
                  title="Delete comment"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="mt-1">{c.content}</div>
          </li>
        ))}
        {items.length === 0 && <li className="opacity-60">No comments yet.</li>}
      </ul>
    </section>
  );
}
