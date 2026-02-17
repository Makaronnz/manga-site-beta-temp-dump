// src/components/LatestClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import MangaCard from "@/components/MangaCard";
import LatestFiltersPanel, { LatestFilters, Tri } from "./LatestFiltersPanel";
import { useLang } from "@/components/LanguageProvider";

type Item = { id: string; title: string; cover: string | null; year: number | null };

type SortKey = "latest" | "popular" | "rating" | "updated";

const LIMIT = 30;

const TYPE_LANGS: Record<"manga" | "manhwa" | "manhua", string[]> = {
  manga: ["ja"],
  manhwa: ["ko"],
  manhua: ["zh", "zh-hk"],
};

export default function LatestClient({
  initialTitle = "",
  initialSort = "latest",
}: {
  initialTitle?: string;
  initialSort?: SortKey;
}) {
  const { t } = useLang();
  const [sort, setSort] = useState<SortKey>(initialSort); // tab/menü
  const [panelOpen, setPanelOpen] = useState(true);

  const [filters, setFilters] = useState<LatestFilters>({
    title: initialTitle,
    ratings: new Set<"safe" | "suggestive" | "erotica">(["safe", "suggestive", "erotica"]),
    demographic: new Set(),
    status: new Set(),
    type: new Set(),
    createdAtSince: undefined,
    yearFrom: undefined,
    yearTo: undefined,
    includeWithoutCh: false,
    tagState: {},
    tagsQuery: "",
  });

  const [items, setItems] = useState<Item[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // ——— sort menüsü mantığı
  const orderKey = useMemo(() => {
    switch (sort) {
      case "popular":
        return "followedCount";
      case "rating":
        return "rating";
      case "updated":
        return "updatedAt";
      default:
        return "latestUploadedChapter";
    }
  }, [sort]);

  // ——— query builder
  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("limit", String(LIMIT));
    sp.set("offset", String(offset));
    sp.set("order", orderKey); // MD paramına bire bir

    if (filters.title.trim()) sp.set("title", filters.title.trim());

    // ratings
    Array.from(filters.ratings).forEach((r) => sp.append("ratings", r));

    // demographic
    Array.from(filters.demographic).forEach((d) => sp.append("publicationDemographic", d));

    // status
    Array.from(filters.status).forEach((s) => sp.append("status", s));

    // type -> originalLanguage / excludedOriginalLanguage
    const t = Array.from(filters.type);
    const picked: string[] = [];
    for (const key of ["manga", "manhwa", "manhua"] as const) {
      if (t.includes(key)) picked.push(...TYPE_LANGS[key]);
    }
    const othersOnly = t.length === 1 && t[0] === "others";
    if (othersOnly) {
      ["ja", "ko", "zh", "zh-hk"].forEach((x) => sp.append("excludedOriginalLanguage", x));
    } else if (picked.length) {
      picked.forEach((x) => sp.append("originalLanguage", x));
    }

    // created since
    if (filters.createdAtSince) sp.set("createdAtSince", filters.createdAtSince);

    // year (tek yıl) – aralık client-side filtrelenecek
    if (filters.yearFrom && filters.yearTo && filters.yearFrom === filters.yearTo) {
      sp.set("year", String(filters.yearFrom));
    }

    // chapters availability
    if (!filters.includeWithoutCh) sp.set("hasAvailableChapters", "true");

    // tags include/exclude
    const includes: string[] = [];
    const excludes: string[] = [];
    Object.entries(filters.tagState).forEach(([id, tri]) => {
      if (tri === 1) includes.push(id);
      else if (tri === 2) excludes.push(id);
    });
    includes.forEach((id) => sp.append("includedTags", id));
    excludes.forEach((id) => sp.append("excludedTags", id));
    sp.set("includedTagsMode", "AND");
    sp.set("excludedTagsMode", "OR");

    return sp.toString();
  }, [filters, offset, orderKey]);

  // ——— reset when filters (except offset) change
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
  }, [
    sort,
    filters.title,
    filters.ratings,
    filters.demographic,
    filters.status,
    filters.type,
    filters.createdAtSince,
    filters.yearFrom,
    filters.yearTo,
    filters.includeWithoutCh,
    filters.tagState,
  ]);

  // ——— fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasMore && offset > 0) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/series/list?${query}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;

        let batch: Item[] = data?.items ?? [];

        // Client-side year range filter (API tek yıl destekler)
        const { yearFrom, yearTo } = filters;
        if (yearFrom || yearTo) {
          batch = batch.filter((it) => {
            const y = it.year ?? 0;
            if (yearFrom && y < yearFrom) return false;
            if (yearTo && y > yearTo) return false;
            return true;
          });
        }

        setItems((prev) => (offset === 0 ? batch : [...prev, ...batch]));
        setHasMore((data?.items?.length ?? 0) === LIMIT);
      } catch {
        setHasMore(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, offset, hasMore, filters.yearFrom, filters.yearTo]);

  return (
    <div>
      {/* Header + sort tabs */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.browse.title}</h1>
          <p className="text-sm opacity-70">{t.browse.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="inline-flex rounded-md border overflow-hidden">
            <button
              className={[
                "h-9 px-3 text-sm",
                sort === "latest" || sort === "rating" || sort === "updated"
                  ? "bg-accent"
                  : "hover:bg-accent",
              ].join(" ")}
              onClick={() => setSort("latest")}
              title={t.browse.latest}
              type="button"
            >
              <i className="fa-solid fa-clock mr-2 md:hidden" />
              <span className="hidden md:inline">{t.browse.latest}</span>
            </button>
            <button
              className={["h-9 px-3 text-sm", sort === "popular" ? "bg-accent" : "hover:bg-accent"].join(" ")}
              onClick={() => setSort("popular")}
              title={t.browse.popular}
              type="button"
            >
              <i className="fa-solid fa-fire mr-2 md:hidden" />
              <span className="hidden md:inline">{t.browse.popular}</span>
            </button>
          </div>

          {/* Latest sub-sort dropdown */}
          {(sort === "latest" || sort === "rating" || sort === "updated") && (
            <div className="relative">
              <details className="group">
                <summary className="list-none h-9 px-3 rounded-md border hover:bg-accent cursor-pointer text-sm flex items-center gap-2">
                  <span>{t.browse.sort}</span>
                  <i className="fa-solid fa-chevron-down text-xs opacity-50" />
                </summary>
                <div className="absolute right-0 mt-1 w-44 rounded-md border bg-background shadow-md p-1 z-10">
                  <button
                    className={[
                      "w-full text-left h-8 px-2 rounded-md text-sm",
                      sort === "rating" ? "bg-accent" : "hover:bg-accent",
                    ].join(" ")}
                    type="button"
                    onClick={() => setSort("rating")}
                  >
                    {t.browse.rating}
                  </button>
                  <button
                    className={[
                      "w-full text-left h-8 px-2 rounded-md text-sm",
                      sort === "updated" ? "bg-accent" : "hover:bg-accent",
                    ].join(" ")}
                    type="button"
                    onClick={() => setSort("updated")}
                  >
                    {t.browse.updated}
                  </button>
                  <div className="border-t my-1" />
                  <button
                    className={[
                      "w-full text-left h-8 px-2 rounded-md text-sm",
                      sort === "latest" ? "bg-accent" : "hover:bg-accent",
                    ].join(" ")}
                    type="button"
                    onClick={() => setSort("latest")}
                  >
                    {t.browse.latest}
                  </button>
                </div>
              </details>
            </div>
          )}

          {/* Filters toggle */}
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="h-9 px-3 rounded-md border hover:bg-accent text-sm flex items-center gap-2"
            type="button"
          >
            <i className="fa-solid fa-filter" />
            <span className="hidden md:inline">{t.browse.filters}</span>
          </button>
        </div>
      </div>

      {/* Search box */}
      <div className="mb-3">
        <input
          value={filters.title}
          onChange={(e) => setFilters({ ...filters, title: e.target.value })}
          className="w-full h-10 px-4 rounded-md border bg-background"
          placeholder={t.browse.searchTitle}
        />
      </div>

      {/* Panel */}
      {panelOpen && (
        <LatestFiltersPanel value={filters} onChange={setFilters} onClose={() => setPanelOpen(false)} />
      )}

      {/* Results */}
      {items.length === 0 && !loading ? (
        <div className="py-20 text-center opacity-60">
          {t.browse.noResults}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-6">
          {items.map((m) => (
            <MangaCard key={m.id} manga={{ id: m.id, title: m.title, cover: m.cover }} />
          ))}
        </div>
      )}

      <div className="flex justify-center my-6">
        <button
          disabled={!hasMore || loading}
          onClick={() => {
            if (!loading && hasMore) setOffset((o) => o + LIMIT);
          }}
          className="px-4 h-10 rounded-md border hover:bg-accent disabled:opacity-50"
          type="button"
        >
          {loading ? t.browse.loading : hasMore ? t.browse.loadMore : t.browse.noMore}
        </button>
      </div>
    </div>
  );
}
