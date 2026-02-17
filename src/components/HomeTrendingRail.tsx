// src/components/HomeTrendingRail.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TrendItem = {
  id: string;
  title: string;
  cover: string | null;
  score: number;
  lastAt: string | null;
  lastChapter: string | null;
  follows: number;
  rating: number | null;
  format: "manga" | "manhwa" | "manhua" | "other";
};

export default function HomeTrendingRail({ initialLang = "en" }: { initialLang?: string }) {
  const [lang, setLang] = useState<string>(initialLang);
  const [items, setItems] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/trending?lang=${encodeURIComponent(lang)}&days=3&limit=36`, { cache: "no-store" });
      const j = await r.json();
      setItems(j.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <section className="container mx-auto px-4 md:px-6 py-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Trending (Recent)</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm opacity-70">Lang</label>
          <select
            className="h-9 rounded-md border bg-background text-sm"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            {["en", "tr", "es", "fr", "de", "pt-br", "ru", "id", "vi", "ar", "it", "any"].map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="opacity-70">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((it) => (
            <Link
              key={it.id}
              href={`/series/${it.id}`}
              className="rounded-xl border overflow-hidden bg-background hover:ring-2 hover:ring-foreground/20 transition"
              title={it.title}
            >
              {it.cover ? (
                <img
                  src={it.cover}
                  alt={it.title}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  className="w-full h-56 object-cover"
                />
              ) : (
                <div className="w-full h-56 grid place-items-center text-sm opacity-60">No cover</div>
              )}
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium line-clamp-1">{it.title}</h3>
                  <span className="text-xs px-2 py-0.5 rounded border opacity-80">{it.format}</span>
                </div>
                <div className="mt-1 text-xs opacity-70">
                  {it.lastChapter ? `Ch. ${it.lastChapter}` : "—"}
                  {it.lastAt ? ` • ${new Date(it.lastAt).toLocaleDateString()}` : ""}
                </div>
              </div>
            </Link>
          ))}
          {items.length === 0 && <div className="opacity-70">No trending titles.</div>}
        </div>
      )}
    </section>
  );
}
