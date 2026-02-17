"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import UpdateCard from "./UpdateCard";
import { dedupeFeed } from "@/lib/dedupe";
import { useLang } from "@/components/LanguageProvider";

type Item = {
  mangaId: string;
  chapterId: string;
  title: string;
  chapter: string | null;
  cover: string | null;
  publishAt: string | null;
};

type ApiResp = { items: Item[]; page: number; hasMore: boolean };

const LIMIT = 24;

export default function RecentUpdates({
  lang = "en",
  title = "Recent Updates",
  blocked = []
}: {
  lang?: string;
  title?: string;
  blocked?: string[];
}) {
  const { t } = useLang();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Reset on filter change
    setPage(1);
    setItems([]);
    setHasMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, JSON.stringify(blocked)]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const u = new URL("/api/home/recent-updates", window.location.href);
      u.searchParams.set("page", String(p));
      u.searchParams.set("limit", String(LIMIT));
      u.searchParams.set("lang", lang);
      for (const b of blocked) u.searchParams.append("excludedTags[]", b);

      const r = await fetch(u.toString(), {
        cache: "no-store",
      });
      const j: ApiResp = await r.json();

      setItems((prev) => {
        if (p === 1) return j.items || [];
        return dedupeFeed([...(prev || []), ...(j.items || [])]);
      });
      setHasMore(Boolean(j?.hasMore));
      setPage(p);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, JSON.stringify(blocked)]);

  // initial load
  useEffect(() => {
    if (page === 1 && items.length === 0) void load(1);
  }, [load, page, items.length]);


  // infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const ent = entries[0];
        if (ent.isIntersecting && !loading && hasMore) {
          void load(page + 1);
        }
      },
      { rootMargin: "800px 0px 800px 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [page, hasMore, loading, load]);

  return (
    <section className="container mx-auto px-4 md:px-6 py-8">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
        {items.map((it) => (
          <UpdateCard key={`${it.mangaId}:${it.chapterId}`} item={it} />
        ))}
        {!loading && items.length === 0 && (
          <div className="col-span-full text-center opacity-70 text-sm">
            {t.common.noResults}
          </div>
        )}
      </div>

      <div ref={loaderRef} className="h-12 flex items-center justify-center">
        {loading ? <span>{t.common.loading}</span> : hasMore ? null : <span>{t.common.end}</span>}
      </div>
    </section>
  );
}

