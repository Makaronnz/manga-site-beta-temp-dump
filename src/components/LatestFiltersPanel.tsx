// src/components/LatestFiltersPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LanguageProvider";

export type Tri = 0 | 1 | 2; // 0=off, 1=include, 2=exclude

export type LatestFilters = {
  // basic
  title: string;
  ratings: Set<"safe" | "suggestive" | "erotica">;
  demographic: Set<"shounen" | "shoujo" | "seinen" | "josei" | "none">;
  status: Set<"ongoing" | "completed" | "hiatus" | "cancelled">;

  // type -> originalLanguage
  type: Set<"manga" | "manhwa" | "manhua" | "others">;

  // time
  createdAtSince?: string; // ISO
  yearFrom?: number;
  yearTo?: number;

  // chapters
  includeWithoutCh: boolean; // true => hasAvailableChapters param gönderme

  // tags (tri-state)
  tagState: Record<string, Tri>;

  // display state
  tagsQuery: string;
};

type Tag = { id: string; name: string; group?: string };

export default function LatestFiltersPanel({
  value,
  onChange,
  onClose,
}: {
  value: LatestFilters;
  onChange: (v: LatestFilters) => void;
  onClose: () => void;
}) {
  const { t } = useLang();

  const CREATED_OPTIONS: { label: string; days: number }[] = [
    { label: "3 days ago", days: 3 },
    { label: "7 days ago", days: 7 },
    { label: "30 days ago", days: 30 },
    { label: "3 months ago", days: 90 },
    { label: "6 months ago", days: 180 },
    { label: "1 year ago", days: 365 },
    { label: "2 years ago", days: 730 },
  ];

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTags(true);
      try {
        const r = await fetch("/api/series/tags", { cache: "no-store" });
        const j = await r.json();
        if (!cancelled) setAllTags(j?.tags ?? []);
      } catch {
        if (!cancelled) setAllTags([]);
      } finally {
        if (!cancelled) setLoadingTags(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTags = useMemo(() => {
    const q = value.tagsQuery.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => (t.name || "").toLowerCase().includes(q));
  }, [allTags, value.tagsQuery]);

  function patch<K extends keyof LatestFilters>(k: K, v: LatestFilters[K]) {
    onChange({ ...value, [k]: v });
  }

  function toggleSet<T extends string>(s: Set<T>, key: T): Set<T> {
    const next = new Set(s);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  function triValue(id: string): Tri {
    return value.tagState[id] ?? 0;
  }
  function triNext(id: string): Tri {
    const cur = triValue(id);
    return ((cur + 1) % 3) as Tri;
  }
  function triLabel(tri: Tri): string {
    return tri === 1 ? "Include" : tri === 2 ? "Exclude" : "Off";
  }

  return (
    <div className="mt-4 rounded-xl border bg-background shadow-sm">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="font-semibold">{t.browse.filterPanel.title}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              onChange({
                title: "",
                ratings: new Set(["safe", "suggestive", "erotica"]),
                demographic: new Set(),
                status: new Set(),
                type: new Set(),
                createdAtSince: undefined,
                yearFrom: undefined,
                yearTo: undefined,
                includeWithoutCh: false,
                tagState: {},
                tagsQuery: "",
              })
            }
            className="h-9 px-3 rounded-md border text-xs hover:bg-accent"
            title={t.browse.filterPanel.clear}
          >
            {t.browse.filterPanel.clear}
          </button>
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-md border text-xs hover:bg-accent"
          >
            {t.browse.filterPanel.close}
          </button>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Genres (just a tag filter for group=genre) */}
        <section className="rounded-lg border">
          <div className="px-3 py-2 border-b font-medium">{t.browse.filterPanel.genres}</div>
          <div className="p-3">
            <input
              className="w-full h-9 px-3 rounded-md border bg-background"
              placeholder={t.search.placeholder}
              value={value.tagsQuery}
              onChange={(e) => patch("tagsQuery", e.target.value)}
            />
            <div className="mt-2 max-h-40 overflow-auto grid grid-cols-2 gap-2">
              {loadingTags ? (
                <div className="col-span-2 text-sm opacity-70">{t.browse.loading}</div>
              ) : (
                filteredTags
                  .filter((t) => t.group === "genre")
                  .map((t) => {
                    const tri = triValue(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          patch("tagState", { ...value.tagState, [t.id]: triNext(t.id) })
                        }
                        className={[
                          "h-8 px-2 rounded-md border text-xs text-left",
                          tri === 1
                            ? "bg-green-600/20 border-green-600/50"
                            : tri === 2
                              ? "bg-red-600/20 border-red-600/50"
                              : "hover:bg-accent",
                        ].join(" ")}
                        title={triLabel(tri)}
                      >
                        {t.name}
                        {tri === 1 ? " + " : tri === 2 ? " − " : ""}
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        </section>

        {/* Tags (all groups) */}
        <section className="rounded-lg border">
          <div className="px-3 py-2 border-b font-medium">
            {t.browse.filterPanel.tags}{" "}
            <span className="ml-1 text-xs opacity-70">{t.browse.filterPanel.tagsHint}</span>
          </div>
          <div className="p-3">
            <div className="max-h-56 overflow-auto grid grid-cols-2 gap-2">
              {loadingTags ? (
                <div className="col-span-2 text-sm opacity-70">{t.browse.loading}</div>
              ) : (
                filteredTags.map((t) => {
                  const tri = triValue(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        patch("tagState", { ...value.tagState, [t.id]: triNext(t.id) })
                      }
                      className={[
                        "h-8 px-2 rounded-md border text-xs text-left",
                        tri === 1
                          ? "bg-green-600/20 border-green-600/50"
                          : tri === 2
                            ? "bg-red-600/20 border-red-600/50"
                            : "hover:bg-accent",
                      ].join(" ")}
                      title={triLabel(tri)}
                    >
                      {t.name}
                      {tri === 1 ? " + " : tri === 2 ? " − " : ""}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Demographic */}
        <section className="rounded-lg border">
          <div className="px-3 py-2 border-b font-medium">{t.browse.filterPanel.demographic}</div>
          <div className="p-3 grid grid-cols-2 gap-y-2 text-sm">
            {(["shounen", "shoujo", "seinen", "josei", "none"] as const).map((d) => (
              <label key={d} className="inline-flex items-center gap-2 capitalize">
                <input
                  type="checkbox"
                  checked={value.demographic.has(d)}
                  onChange={() => patch("demographic", toggleSet(value.demographic, d))}
                />
                {d}
              </label>
            ))}
          </div>
        </section>

        {/* Created at */}
        <section className="rounded-lg border">
          <div className="px-3 py-2 border-b font-medium">{t.browse.filterPanel.createdAt}</div>
          <div className="p-3">
            <select
              className="w-full h-9 rounded-md border bg-background"
              value={value.createdAtSince || ""}
              onChange={(e) => patch("createdAtSince", e.target.value || undefined)}
            >
              <option value="">{t.browse.filterPanel.any}</option>
              {CREATED_OPTIONS.map((o) => {
                const dt = new Date();
                dt.setUTCDate(dt.getUTCDate() - o.days);
                const iso = dt.toISOString();
                return (
                  <option key={o.label} value={iso}>
                    {o.label}
                  </option>
                );
              })}
            </select>
          </div>
        </section>

        {/* Type */}
        <section className="rounded-lg border">
          <div className="px-3 py-2 border-b font-medium">{t.browse.filterPanel.type}</div>
          <div className="p-3 grid grid-cols-2 gap-y-2 text-sm">
            {(["manhua", "manga", "manhwa", "others"] as const).map((t) => (
              <label key={t} className="inline-flex items-center gap-2 capitalize">
                <input
                  type="checkbox"
                  checked={value.type.has(t)}
                  onChange={() => patch("type", toggleSet(value.type, t))}
                />
                {t}
              </label>
            ))}
          </div>
        </section>

        {/* Minimum chapters (bilgilendirme) */}
        <section className="rounded-lg border">
          <div className="px-3 py-2 border-b font-medium">{t.browse.filterPanel.minChapters}</div>
          <div className="p-3">
            <input
              className="w-full h-9 rounded-md border bg-background opacity-60 pointer-events-none"
              placeholder="Coming soon"
              disabled
            />
            <div className="mt-1 text-xs opacity-70">
              ({t.browse.filterPanel.myList})
            </div>
          </div>
        </section>

        {/* Status */}
        <section className="rounded-lg border">
          <div className="px-3 py-2 border-b font-medium">{t.browse.filterPanel.status}</div>
          <div className="p-3 grid grid-cols-2 gap-y-2 text-sm">
            {(["ongoing", "completed", "hiatus", "cancelled"] as const).map((s) => (
              <label key={s} className="inline-flex items-center gap-2 capitalize">
                <input
                  type="checkbox"
                  checked={value.status.has(s)}
                  onChange={() => patch("status", toggleSet(value.status, s))}
                />
                {s}
              </label>
            ))}
          </div>
        </section>

        {/* Released */}
        <section className="rounded-lg border">
          <div className="px-3 py-2 border-b font-medium">{t.browse.filterPanel.released}</div>
          <div className="p-3 grid grid-cols-2 gap-2">
            <select
              className="h-9 rounded-md border bg-background"
              value={value.yearFrom ?? ""}
              onChange={(e) => patch("yearFrom", e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">{t.browse.filterPanel.from}</option>
              {Array.from({ length: 70 }, (_, i) => 1970 + i)
                .reverse()
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </select>
            <select
              className="h-9 rounded-md border bg-background"
              value={value.yearTo ?? ""}
              onChange={(e) => patch("yearTo", e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">{t.browse.filterPanel.to}</option>
              {Array.from({ length: 70 }, (_, i) => 1970 + i)
                .reverse()
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </select>
          </div>
        </section>

        {/* Content rating */}
        <section className="rounded-lg border">
          <div className="px-3 py-2 border-b font-medium">{t.browse.filterPanel.contentRating}</div>
          <div className="p-3 grid grid-cols-2 gap-y-2 text-sm">
            {(["safe", "suggestive", "erotica"] as const).map((r) => (
              <label key={r} className="inline-flex items-center gap-2 capitalize">
                <input
                  type="checkbox"
                  checked={value.ratings.has(r)}
                  onChange={() => patch("ratings", toggleSet(value.ratings, r))}
                />
                {r}
              </label>
            ))}
          </div>
        </section>

        {/* Chapters availability */}
        <section className="rounded-lg border">
          <div className="px-3 py-2 border-b font-medium">{t.browse.filterPanel.options}</div>
          <div className="p-3 space-y-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.includeWithoutCh}
                onChange={(e) => patch("includeWithoutCh", e.target.checked)}
              />
              {t.browse.filterPanel.includeNoCh}
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
