// src/components/SeriesChaptersClient.tsx
/**
 * INFO:
 * Series page chapter table (client).
 * - Manual Save ALWAYS respects your choice (older or newer): posts to /api/reading/save with { seriesId, chapterId, chapter, force:true }.
 * - Last-read state hydrates from /api/reading/last (works with slug/uuid/numeric).
 * - “Read →” opens the reader using a canonical chapter slug.
 * - “Goto chap” respects current language and prefers the selected group if available.
 * - Build fix: removed an extra ')' in title sort compare.
 * - After saving, emits "mc-reading-updated" to refresh Profile/Library widgets.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { timeAgo } from "@/lib/time";

type ChapterRow = {
  id: string;
  chapter: string;
  title?: string;
  pages?: number;
  publishAt?: string | null;
  lang?: string;
  groupId?: string | null;
  groupName?: string | null;
};

type GroupInfo = { id: string; name: string };

type ChaptersResp = {
  items: ChapterRow[];
  availableLangs?: string[];
  groups?: GroupInfo[];
  selectedGroup?: string;
};

type FollowStatus =
  | "Unfollow"
  | "Reading"
  | "Completed"
  | "On-Hold"
  | "Dropped"
  | "Plan to Read";

function toNum(v: string) {
  const s = (v || "").match(/[\d.]+/g)?.join("") ?? "";
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : -Infinity;
}

const PER_PAGE = 50;

/** Stable UTC tooltip formatter */
function formatUTC(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss} UTC`;
}

export default function SeriesChaptersClient(props: {
  seriesId: string;
  items: ChapterRow[];
  availableLangs?: string[];
  selectedLang?: string;
  groups?: GroupInfo[];
  selectedGroup?: string;
}) {
  const {
    seriesId,
    items,
    availableLangs = [],
    selectedLang = "en",
    groups = [],
    selectedGroup = "all",
  } = props;

  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // Prefer pretty slug from current URL if present
  const seriesSlug = useMemo(() => {
    try {
      const parts = (
        pathname || (typeof window !== "undefined" ? window.location.pathname : "")
      )
        .split("/")
        .filter(Boolean);
      const i = parts.indexOf("series");
      if (i >= 0 && parts[i + 1]) return decodeURIComponent(parts[i + 1]);
    } catch {}
    return null;
  }, [pathname]);

  // ----- Local state (filter/sort/paging) -----
  const [lang, setLang] = useState<string>((selectedLang || "en").toLowerCase());
  const [group, setGroup] = useState<string>((selectedGroup || "all").toLowerCase());

  const [sortKey, setSortKey] = useState<"chapter" | "uploaded" | "title">("chapter");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const [page, setPage] = useState(1);
  const start = (page - 1) * PER_PAGE;

  // DB-hydrated last-read (for the bookmark fill)
  const [lastReadChapterId, setLastReadChapterId] = useState<string | null>(null);

  // Follow state (purely for potential UI toggles; Save works regardless)
  const [isFollowed, setIsFollowed] = useState<boolean>(true);

  // Mount: load follow & last-read
  useEffect(() => {
    let aborted = false;

    (async () => {
      try {
        const fr = await fetch(
          `/api/follow?seriesId=${encodeURIComponent(seriesId)}`,
          { cache: "no-store" }
        );
        const fj = await fr.json().catch(() => ({}));
        if (!aborted) setIsFollowed(!!(fj?.followed ?? false));
      } catch {}

      try {
        const rr = await fetch(
          `/api/reading/last?seriesId=${encodeURIComponent(seriesId)}`,
          { cache: "no-store" }
        );
        const rj = await rr.json().catch(() => ({} as any));
        const savedId = rj?.chapterId as string | undefined;
        if (!aborted) setLastReadChapterId(savedId || null);
      } catch {}
    })();

    return () => {
      aborted = true;
    };
  }, [seriesId]);

  // ---------- Normalize list ----------
  const langs = useMemo(() => {
    const set = new Set<string>(
      ["en", ...(availableLangs || [])].filter(Boolean).map((s) => s.toLowerCase())
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [availableLangs]);

  // Build group display names per language from incoming items
  const groupsByLang = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const it of items) {
      const L = (it.lang || "en").toLowerCase();
      const G = (it.groupName || "").toString();
      if (!map.has(L)) map.set(L, new Set<string>());
      if (G) map.get(L)!.add(G);
    }
    return map;
  }, [items]);

  const groupsForLang = useMemo(() => {
    const L = (lang || "en").toLowerCase();
    const set = groupsByLang.get(L) || new Set<string>();
    return ["All", ...Array.from(set.values()).sort((a, b) => a.localeCompare(b))];
  }, [lang, groupsByLang]);

  const rows = useMemo(() => {
    const L = (lang || "en").toLowerCase();
    const G = (group || "all").toLowerCase();

    const list = items
      .filter((it) => (L === "any" ? true : (it.lang || "en").toLowerCase() === L))
      .filter((it) => (G === "all" ? true : (it.groupName || "").toLowerCase() === G));

    const sorted = list.slice().sort((a, b) => {
      const dirMul = dir === "asc" ? 1 : -1;
      if (sortKey === "chapter")
        return dirMul * (toNum(a.chapter) - toNum(b.chapter));
      if (sortKey === "uploaded") {
        const ta = a.publishAt ? new Date(a.publishAt).getTime() : 0;
        const tb = b.publishAt ? new Date(b.publishAt).getTime() : 0;
        return dirMul * (ta - tb);
      }
      // title
      return (
        dirMul *
        String(a.title || "").localeCompare(String(b.title || ""))
      ); // ← fixed extra ')'
    });

    return sorted;
  }, [items, lang, group, sortKey, dir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const clampedPage = Math.min(Math.max(page, 1), pageCount);
  const end = Math.min(start + PER_PAGE, rows.length);
  const pageItems = rows.slice(start, end);

  // ----- URL query sync (nice UX when sharing links) -----
  function pushQuery(nextLang: string, nextGroup: string) {
    const params = new URLSearchParams(search?.toString() || "");
    if (nextLang && nextLang !== "any") params.set("lang", nextLang);
    else params.delete("lang");
    if (nextGroup && nextGroup !== "all") params.set("group", nextGroup);
    else params.delete("group");
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  // Prefer selected group when jumping by number
  function goToChapterNumber(num: string) {
    if (!num) return;
    const pool = items
      .filter((it) => (lang === "any" ? true : (it.lang || "").toLowerCase() === lang))
      .filter((it) => String(it.chapter) === num);

    if (!pool.length) return;

    let chosen = pool[0];
    if (group !== "all") {
      const alt = pool.find(
        (p) => (p.groupName || "").toLowerCase() === group.toLowerCase()
      );
      if (alt) chosen = alt;
    }

    seriesSlug
      ? router.push(
          `/series/${encodeURIComponent(seriesSlug)}/${buildChapterSlug(chosen)}`
        )
      : router.push(`/series/${seriesId}/chapter/${chosen.id}`);
  }

  return (
    <div className="mt-6">
      {/* top bar */}
      <div className="rounded-xl border p-3 flex flex-wrap items-center gap-2 justify-between">
        <div className="text-sm opacity-80">
          Showing chapters {start + 1} to {end} — page {clampedPage} / {pageCount}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm opacity-70 mr-1">Goto chap</label>
          <select
            className="h-9 rounded-md border bg-background text-sm min-w-28"
            onChange={(e) => goToChapterNumber(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {Array.from(new Set(items.map((i) => String(i.chapter))))
              .sort((a, b) => toNum(a) - toNum(b))
              .map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
          </select>

          <span className="text-sm opacity-60">|</span>

          <label className="text-sm opacity-70">Lang:</label>
          <select
            className="h-9 rounded-md border bg-background text-sm min-w-28"
            value={lang}
            onChange={(e) => {
              const l = e.target.value.toLowerCase();
              setLang(l);
              setPage(1);
              pushQuery(l, group);
            }}
          >
            {["any", ...langs].map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>

          <label className="text-sm opacity-70">Sort:</label>
          <div className="inline-flex rounded-md overflow-hidden border">
            <button
              className="h-9 px-3 border-r hover:bg-accent"
              onClick={() => {
                if (sortKey === "chapter")
                  setDir((d) => (d === "asc" ? "desc" : "asc"));
                setSortKey("chapter");
              }}
              type="button"
            >
              Chap
            </button>
            <button
              className="h-9 px-3 border-r hover:bg-accent"
              onClick={() => {
                if (sortKey === "title")
                  setDir((d) => (d === "asc" ? "desc" : "asc"));
                setSortKey("title");
              }}
              type="button"
            >
              Title
            </button>
            <button
              className="h-9 px-3 rounded-md border hover:bg-accent"
              onClick={() => {
                if (sortKey === "uploaded")
                  setDir((d) => (d === "asc" ? "desc" : "asc"));
                setSortKey("uploaded");
              }}
              type="button"
            >
              Uploaded
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm opacity-70">Group:</label>
            <select
              className="h-9 rounded-md border bg-background text-sm min-w-40"
              value={group === "all" ? "All" : group}
              onChange={(e) => {
                const g = e.target.value;
                const nextGroup = g === "All" ? "all" : g;
                setGroup(nextGroup);
                setPage(1);
                pushQuery(lang, nextGroup);
              }}
            >
              {groupsForLang.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* table */}
      <div className="mt-3 overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left px-4 py-2 w-24">
                <button
                  className="underline decoration-dotted"
                  onClick={() => {
                    if (sortKey === "chapter")
                      setDir((d) => (d === "asc" ? "desc" : "asc"));
                    setSortKey("chapter");
                  }}
                >
                  Chap {sortKey === "chapter" ? (dir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="text-left px-4 py-2">Title</th>
              <th className="text-right px-4 py-2 w-20">Pages</th>
              <th className="text-center px-4 py-2 w-20">Lang</th>
              <th className="text-left px-4 py-2 w-56">Group</th>
              <th className="text-right px-4 py-2 w-40">Uploaded</th>
              <th className="text-right px-4 py-2 w-24">Save</th>
              <th className="text-right px-4 py-2 w-28">Read</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row) => {
              const isSaved = lastReadChapterId === row.id;
              return (
                <tr key={row.id} className="group border-b hover:bg-accent/40">
                  <td className="px-4 py-2 font-medium">
                    Ch. {row.chapter || "Oneshot"}
                  </td>
                  <td className="px-4 py-2">{row.title || "-"}</td>
                  <td className="px-4 py-2 text-right">{row.pages ?? "-"}</td>
                  <td className="px-4 py-2 text-center">
                    {(row.lang || "en").toUpperCase()}
                  </td>
                  <td className="px-4 py-2">
                    {row.groupName ? (
                      <Link
                        href={`/group/${encodeURIComponent(row.groupName)}`}
                        className="underline decoration-dotted hover:opacity-80"
                      >
                        {row.groupName}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className="inline-block min-w-[140px] text-right tabular-nums"
                      title={formatUTC(row.publishAt)}
                    >
                      {row.publishAt ? timeAgo(row.publishAt) : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={async () => {
                        try {
                          await fetch("/api/reading/save", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              seriesId,
                              chapterId: row.id,
                              chapter: row.chapter,
                              force: true, // explicit: manual save always wins
                            }),
                          });
                          setLastReadChapterId(row.id);
                          try {
                            window.dispatchEvent(new CustomEvent("mc-reading-updated"));
                          } catch {}
                        } catch {}
                      }}
                      className={[
                        "h-9 px-3 rounded-md border inline-flex items-center gap-2 hover:bg-accent",
                        isSaved ? "border-foreground/70" : "border-border",
                        "opacity-100",
                      ].join(" ")}
                    >
                      {isSaved ? FilledBookmark() : OutlineBookmark()}
                    </button>
                  </td>

                  <td className="px-4 py-2 text-right">
                    <button
                      className="h-9 px-3 rounded-md border hover:bg-accent"
                      onClick={() =>
                        seriesSlug
                          ? router.push(
                              `/series/${encodeURIComponent(
                                seriesSlug
                              )}/${buildChapterSlug(row)}`
                            )
                          : router.push(`/series/${seriesId}/chapter/${row.id}`)
                      }
                      type="button"
                    >
                      Read →
                    </button>
                  </td>
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center opacity-70" colSpan={8}>
                  No chapters for current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm opacity-70">
          Showing <span className="font-medium">{start + 1}</span> to{" "}
          <span className="font-medium">{end}</span> of{" "}
          <span className="font-medium">{rows.length}</span> chapters
        </div>

        <div className="flex items-center gap-2">
          <button
            className="h-9 px-3 rounded-md border hover:bg-accent disabled:opacity-50"
            onClick={() => setPage(1)}
            disabled={clampedPage === 1}
            type="button"
          >
            « First
          </button>
          <button
            className="h-9 px-3 rounded-md border hover:bg-accent disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={clampedPage === 1}
            type="button"
          >
            ‹ Prev
          </button>
          <span className="text-sm tabular-nums">
            Page {clampedPage} / {pageCount}
          </span>
          <button
            className="h-9 px-3 rounded-md border hover:bg-accent disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={clampedPage === pageCount}
            type="button"
          >
            Next ›
          </button>
          <button
            className="h-9 px-3 rounded-md border hover:bg-accent disabled:opacity-50"
            onClick={() => setPage(pageCount)}
            disabled={clampedPage === pageCount}
            type="button"
          >
            Last »
          </button>
        </div>
      </div>
    </div>
  );
}

function OutlineBookmark() {
  return (
    <svg viewBox="0 0 384 512" aria-hidden="true" width="16" height="16">
      <path
        fill="currentColor"
        d="M320 0c35.3 0 64 28.7 64 64V512L192 400 0 512V64C0 28.7 28.7 0 64 0H320zM64 48c-8.8 0-16 7.2-16 16V452l144-84 144 84V64c0-8.8 7.2-16 16-16H64z"
      />
    </svg>
  );
}
function FilledBookmark() {
  return (
    <svg viewBox="0 0 384 512" aria-hidden="true" width="16" height="16">
      <path
        fill="currentColor"
        d="M0 64C0 28.7 28.7 0 64 0H320c35.3 0 64 28.7 64 64V512L192 400 0 512V64z"
      />
    </svg>
  );
}

/* ---------- Canonical chapter slug helpers ---------- */
function short8(id?: string | null) {
  return (id || "").replace(/-/g, "").slice(0, 8) || "unknown";
}
function normalizeLabel(label?: string | null): string {
  if (!label) return "oneshot";
  const raw = String(label).trim();
  if (/^one[-\s]?shot$/i.test(raw)) return "oneshot";
  return raw;
}
function buildChapterSlug(row: {
  id: string;
  chapter?: string | null;
  lang?: string | null;
  groupId?: string | null;
  group?: string | null;
}): string {
  const g = short8(row.groupId || row.group || null);
  const label = encodeURIComponent(normalizeLabel(row.chapter || ""));
  const lang = (row.lang || "en").toLowerCase();
  return `g-${g}-chapter-${label}-${lang}`;
}
