// src/components/MostRecentPopularRail.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Item = {
  id: string;
  title: string;
  year: number | null;
  cover: string | null;
  description: string;
};

type Props = {
  days?: number; // default 30
  metric?: "follows" | "rating"; // default follows
  title?: string; // default "Most Recent Popular"
};

export default function MostRecentPopularRail({ days = 30, metric = "follows", title }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [activeMetric, setActiveMetric] = useState<"follows" | "rating">(metric);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const heading = useMemo(
    () => title || `Most Recent Popular (${days}d)`,
    [title, days]
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ days: String(days), metric: activeMetric, limit: "24" });
        const res = await fetch(`/api/home/most-popular-month?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (!cancelled) setItems(j.items || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [days, activeMetric]);

  function scrollBy(dir: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.85;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  }

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{heading}</h2>

        <div className="flex gap-2">
          <div className="rounded-full border p-1">
            <button
              type="button"
              className={[
                "h-8 px-3 rounded-full text-xs",
                activeMetric === "follows" ? "bg-accent" : "hover:bg-accent"
              ].join(" ")}
              onClick={() => setActiveMetric("follows")}
              aria-pressed={activeMetric === "follows"}
              title="Sort by Follows"
            >
              Follows
            </button>
            <button
              type="button"
              className={[
                "h-8 px-3 rounded-full text-xs",
                activeMetric === "rating" ? "bg-accent" : "hover:bg-accent"
              ].join(" ")}
              onClick={() => setActiveMetric("rating")}
              aria-pressed={activeMetric === "rating"}
              title="Sort by Rating"
            >
              Rating
            </button>
          </div>

          <div className="hidden sm:flex gap-2">
            <button
              type="button"
              onClick={() => scrollBy("left")}
              className="h-8 w-8 rounded-full border hover:bg-accent flex items-center justify-center"
              aria-label="Scroll left"
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy("right")}
              className="h-8 w-8 rounded-full border hover:bg-accent flex items-center justify-center"
              aria-label="Scroll right"
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-500">Failed to load: {error}</div>
      ) : (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent" />
          <div ref={scrollerRef} className="no-scrollbar overflow-x-auto scroll-smooth">
            <ol className="flex gap-4 pr-2">
              {(loading ? Array.from({ length: 10 }) : items).map((it, idx) => (
                <li key={(it as any)?.id || idx} className="w-[160px] shrink-0">
                  <Link
                    href={(it as any)?.id ? `/series/${(it as any).id}` : "#"}
                    className="group block"
                    tabIndex={loading ? -1 : 0}
                  >
                    <div className="relative w-full pb-[140%] rounded-xl overflow-hidden border bg-muted/10">
                      {loading ? (
                        <div className="absolute inset-0 animate-pulse bg-muted/30" />
                      ) : (it as any)?.cover ? (
                        <Image
                          src={(it as any).cover}
                          alt={(it as any).title}
                          fill
                          sizes="160px"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-sm line-clamp-2">
                      {loading ? <span className="inline-block w-24 h-3 bg-muted/40 animate-pulse rounded" /> : (it as any).title}
                    </div>
                    <div className="text-xs opacity-70">
                      {loading ? <span className="inline-block w-20 h-3 bg-muted/30 animate-pulse rounded" /> : (it as any).description}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
