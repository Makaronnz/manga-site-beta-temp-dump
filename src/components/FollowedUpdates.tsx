// info: Client list for followed updates; fetches API, hydrates slugs, renders UpdateCard grid.

"use client";

import { useEffect, useRef, useState } from "react";
import UpdateCard from "./UpdateCard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLang } from "@/components/LanguageProvider";

type Item = {
  mangaId: string;          // slug veya MD UUID (slug-map ile kanonize ediyoruz)
  chapterId: string;
  title: string;
  chapter: string | null;
  cover: string | null;
  publishAt: string | null;
};

export default function FollowedUpdates({ limit = 24 }: { limit?: number }) {
  const { t } = useLang();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugMap, setSlugMap] = useState<Record<string, string>>({});
  const timer = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [visible, setVisible] = useState(false);

  const fetchUpdates = async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/home/followed-updates?limit=${limit}&ts=${Date.now()}`, {
        cache: "no-store",
        signal: ac.signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j: { items: Item[] } = await r.json();
      const list = j.items || [];
      setItems(list);

      // Slug hydration: Eğer API zaten slug döndüyse (bizim yeni route döndürüyor),
      // slug-map çıkmayabilir; yine de toplu map deneyip fallback bırakıyoruz.
      if (list.length) {
        const idsCsv = list.map((x) => x.mangaId).join(",");
        const m = await fetch(
          `/api/series/slug-map?ids=${encodeURIComponent(idsCsv)}&hydrate=1`,
          { cache: "no-store" }
        );
        if (m.ok) {
          const jj = (await m.json()) as { map?: Record<string, string> };
          setSlugMap(jj.map || {});
        } else {
          setSlugMap({});
        }
      } else {
        setSlugMap({});
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setError("Could not load updates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check auth visibility first
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data }) => {
      if (data.user) {
        setVisible(true);
        fetchUpdates();
      } else {
        setVisible(false);
      }
    });

    const onUpdate = () => { if (visible) fetchUpdates(); };
    window.addEventListener("mc-follow-updated" as any, onUpdate);
    timer.current = window.setInterval(() => { if (visible) fetchUpdates(); }, 180_000);

    return () => {
      window.removeEventListener("mc-follow-updated" as any, onUpdate);
      if (timer.current) window.clearInterval(timer.current);
      abortRef.current?.abort();
    };
  }, [limit, visible]); // re-run if visibility changes to start fetching

  const itemsForRender = items.map((it) => ({
    ...it,
    mangaId: slugMap[it.mangaId] ?? it.mangaId,
  }));

  if (!visible) return null; // Hide completely if not logged in

  return (
    <section className="container mx-auto px-4 md:px-6 mt-10">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{t.follows.title}</h2>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <button
            type="button"
            onClick={fetchUpdates}
            className="h-8 px-3 rounded-md border hover:bg-accent text-xs"
            disabled={loading}
            title={t.follows.refresh}
          >
            {loading ? t.follows.refreshing : `${t.follows.refresh} ↻`}
          </button>
        </div>
      </div>

      {!items.length && !loading && !error && (
        <p className="text-sm opacity-75">
          {t.follows.empty}
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
      {!!itemsForRender.length && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4 transition-opacity duration-200" style={{ opacity: loading ? 0.7 : 1 }}>
          {itemsForRender.map((it, i) => (
            <UpdateCard key={`${it.mangaId}:${it.chapterId}`} item={it} priority={i === 0} />
          ))}
        </div>
      )}
    </section>
  );
}
