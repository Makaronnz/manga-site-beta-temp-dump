"use client";

/**
 * info:
 * Reading History bileşeni.
 * - /api/home/reading-history'den veriyi çeker (no-store).
 * - UpdateCard ile grid halinde gösterir; Refresh düğmesi ve skeleton içerir.
 */
import { useEffect, useRef, useState } from "react";
import UpdateCard from "./UpdateCard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Item = {
  mangaId: string;          // series.slug
  chapterId: string;
  title: string;
  chapter: string | null;
  cover: string | null;
  publishAt: string | null; // updatedAt
};

export default function ReadingHistory({ limit = 24, title = "Reading History" }: { limit?: number; title?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [visible, setVisible] = useState(false);

  const fetchHistory = async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/home/reading-history?limit=${limit}&ts=${Date.now()}`, {
        cache: "no-store",
        signal: ac.signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j: { items: Item[] } = await r.json();
      setItems(j.items || []);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError("Could not load history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setVisible(true);
        fetchHistory();
      } else {
        setVisible(false);
      }
    });

    // Sekme görünür olunca tazele + düşük frekansta yenile (5 dk)
    const onVis = () => {
      if (document.visibilityState === "visible" && visible) fetchHistory();
    };

    document.addEventListener("visibilitychange", onVis);
    timer.current = window.setInterval(() => {
      if (visible) fetchHistory();
    }, 300_000);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (timer.current) window.clearInterval(timer.current);
      abortRef.current?.abort();
    };
  }, [limit, visible]);

  if (!visible) return null;

  return (
    <section className="container mx-auto px-4 md:px-6 mt-12">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <button
            type="button"
            onClick={fetchHistory}
            className="h-8 px-3 rounded-md border hover:bg-accent text-xs"
            disabled={loading}
            title="Refresh"
          >
            {loading ? "Refreshing…" : "Refresh ↻"}
          </button>
        </div>
      </div>

      {!items.length && !loading && !error && (
        <p className="text-sm opacity-75">
          Your recent reading progress will appear here.
        </p>
      )}

      {/* Skeleton - Only show if loading AND we have no items */}
      {loading && items.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: Math.min(12, limit) }).map((_, i) => (
            <div key={i} className="rounded-md overflow-hidden border bg-card animate-pulse">
              <div className="w-full aspect-[3/4] bg-muted" />
              <div className="p-2 space-y-2">
                <div className="h-3 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show items if we have them, even if refreshing */}
      {!!items.length && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4 transition-opacity duration-200" style={{ opacity: loading ? 0.7 : 1 }}>
          {items.map((it, i) => (
            <UpdateCard key={`${it.mangaId}:${it.chapterId}:${i}`} item={it} priority={i === 0} />
          ))}
        </div>
      )}
    </section>
  );
}
