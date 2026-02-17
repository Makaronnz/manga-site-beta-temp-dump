// src/components/ChapterReaderClient.tsx
/**
 * INFO:
 * Reader UI with proper group names + correct progress behavior.
 * - The Group dropdown SHOWS scanlation group names (not UUIDs).
 * - “Next →” SAVES progress (forward-only) via /api/reading with {seriesId, chapterId, chapter}.
 * - “← Prev” DOES NOT save.
 * - “Goto chapter” respects selected language and prefers the selected group if available.
 * - Uses pretty series slug in the URL if present (fallback to seriesId).
 * - UI strings are in English for MakaronComiks.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/LanguageProvider";

/* -------------------------------- Types --------------------------------- */

type Props = {
  /** MangaDex manga id (or internal id). */
  seriesId: string;
  /** Current chapter id (MangaDex chapter UUID). */
  chapterId: string;
  /** Absolute URLs of page images to render. */
  images: string[];
};

type ChapterRow = {
  id: string;
  chapter: string | null;
  title?: string | null;
  pages?: number;
  publishAt?: string | null;

  /** Language code (e.g., "en") */
  lang?: string | null;

  /** Canonical single group id (preferred; taken from API or first of groups[]). */
  groupId?: string | null;
  /** Fallback list for legacy APIs. */
  groups?: string[] | null;

  /** Human display name for the group. */
  groupName?: string | null;

  /** Optional short8 of group id for slug building (if provided by API). */
  groupShort?: string | null;
};

type ChaptersResp = {
  items: ChapterRow[];
  /** Unique set of langs for the dropdown. */
  availableLangs?: string[];
};

/* ------------------------------- Helpers -------------------------------- */

function toNum(v: string | null | undefined) {
  if (!v) return -Infinity;
  const s = v.match(/[\d.]+/g)?.join("") ?? "";
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : -Infinity;
}

function short8(id?: string | null) {
  return (id || "").replace(/-/g, "").slice(0, 8) || "unknown";
}

function normalizeLabel(label?: string | null): string {
  if (!label) return "oneshot";
  const raw = String(label).trim();
  if (/^one[-\s]?shot$/i.test(raw)) return "oneshot";
  return raw;
}

/* ----------------------------- Component -------------------------------- */

const BASE_WIDTH = 980;
const MIN_Z = 0.3;
const MAX_Z = 1.6;
const STEP_Z = 0.1;

const COMMENT_WIDTH = 440;
const GAP_TO_PANEL = 24;
const GUTTER = 24 * 2;

export default function ChapterReaderClient({ seriesId, chapterId, images }: Props) {
  const router = useRouter();
  const { t } = useLang();

  /* --------- Derive series slug from URL (for canonical links/fallback) --------- */
  const seriesSlug = useMemo(() => {
    try {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const i = parts.indexOf("series");
      return i >= 0 && parts[i + 1] ? decodeURIComponent(parts[i + 1]) : null;
    } catch {
      return null;
    }
  }, []);

  /* --------------------------------- UI State ---------------------------------- */
  const [zoom, setZoom] = useState(1);
  const [showComments, setShowComments] = useState(false);

  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [langs, setLangs] = useState<string[]>(["any", "en"]);
  const [lang, setLang] = useState<string>("en");

  /**
   * Selected scanlation group (ALWAYS a groupId string, or "any")
   */
  const [group, setGroup] = useState<string>("any");

  // series meta (center button)
  const [seriesCover, setSeriesCover] = useState<string | null>(null);
  const [seriesTitle, setSeriesTitle] = useState<string>("Series");

  /* ------------------------- Series title/cover (optional) ---------------------- */
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        if (!seriesId) return;
        const r = await fetch(`https://api.mangadex.org/manga/${seriesId}?includes[]=cover_art`, {
          cache: "no-store",
        });
        const j = await r.json();
        if (!ok) return;
        const data = j?.data;
        const titleObj = data?.attributes?.title || {};
        const title =
          titleObj?.en ||
          (Object.values(titleObj)[0] as string | undefined) ||
          data?.attributes?.altTitles?.[0]?.en ||
          "Series";
        setSeriesTitle(title);
        const rel = (data?.relationships || []).find((x: any) => x?.type === "cover_art");
        const file = rel?.attributes?.fileName;
        setSeriesCover(file ? `https://uploads.mangadex.org/covers/${seriesId}/${file}.256.jpg` : null);
      } catch {
        /* optional only */
      }
    })();
    return () => {
      ok = false;
    };
  }, [seriesId]);

  /* -------------------------- Auto-hide top toolbar ----------------------------- */
  const [barHidden, setBarHidden] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;
      lastY.current = y;
      if (y < 12) return setBarHidden(false);
      if (dy > 6) setBarHidden(true);
      else if (dy < -6) setBarHidden(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ---------------------------- Layout measurements ----------------------------- */
  // Fix hydration mismatch: Start with server-safe default (1200), update on mount.
  const [vw, setVw] = useState<number>(1200);
  useEffect(() => {
    // Set initial real width
    setVw(window.innerWidth);

    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isDesktop = vw >= 768;
  const panelOpenDesktop = showComments && isDesktop;

  /* ----------------------- Fetch chapter list (id or slug) ---------------------- */
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (seriesId) qs.set("id", seriesId);
        else if (seriesSlug) qs.set("slug", seriesSlug);
        else qs.set("id", "");
        qs.set("lang", "any");

        const r = await fetch(`/api/series/chapters?${qs.toString()}`, { cache: "no-store" });
        if (!r.ok) return;
        const j: ChaptersResp = await r.json();
        if (canceled) return;

        const items = (j.items || [])
          .map((it) => {
            // Normalize: always have groupId; keep best-effort name
            const canonicalGroupId =
              it.groupId ||
              (Array.isArray(it.groups) ? it.groups[0] : undefined) ||
              null;

            const displayName =
              it.groupName ||
              (canonicalGroupId ? `Group ${short8(canonicalGroupId)}` : null);

            return {
              ...it,
              groupId: canonicalGroupId,
              groupName: displayName,
            };
          })
          .filter((it) => it.chapter && it.chapter !== "Oneshot");

        setChapters(items);

        const self = items.find((x) => x.id === chapterId);
        setLang((self?.lang || "en").toLowerCase());
        setGroup(self?.groupId || "any");

        const allLangs = Array.from(
          new Set(["any", ...(j.availableLangs || []).map((s) => s.toLowerCase())])
        );
        setLangs(allLangs);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      canceled = true;
    };
  }, [seriesId, seriesSlug, chapterId]);

  /* ------------------------ Derived lists & navigation -------------------------- */
  const listByLangAnyGroup = useMemo(
    () =>
      chapters
        .filter((c) => (lang === "any" ? true : (c.lang || "en").toLowerCase() === lang))
        .sort((a, b) => toNum(a.chapter) - toNum(b.chapter)),
    [chapters, lang]
  );

  /**
   * Distinct groups for the selected language.
   * We return an array of { id: groupId, name: groupName } and sort by `name`.
   * The "any" option is injected as { id: "any", name: "any" }.
   */
  const groupsForLang = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of listByLangAnyGroup) {
      const id = c.groupId || (Array.isArray(c.groups) ? c.groups[0] : null);
      if (!id) continue;
      const name = c.groupName || `Group ${short8(id)}`;
      // keep the first nice name we see
      if (!map.has(id)) map.set(id, name);
    }
    const arr = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    arr.sort((a, b) => a.name.localeCompare(b.name));
    return [{ id: "any", name: "any" }, ...arr];
  }, [listByLangAnyGroup]);

  // Keep selection valid if list changes
  useEffect(() => {
    const validIds = new Set(groupsForLang.map((g) => g.id));
    if (!validIds.has(group)) setGroup("any");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsForLang]);

  const currentRow = useMemo(
    () => chapters.find((c) => c.id === chapterId) || null,
    [chapters, chapterId]
  );
  const currentNumber = useMemo(
    () => (currentRow ? toNum(currentRow.chapter) : -Infinity),
    [currentRow]
  );

  const nextRow = useMemo(() => {
    const bigger = listByLangAnyGroup.filter((c) => toNum(c.chapter) > currentNumber);
    if (!bigger.length) return null;
    const nextNum = toNum(bigger[0].chapter);
    const sameNumPool = listByLangAnyGroup.filter((c) => toNum(c.chapter) === nextNum);
    // prefer same group if selected
    const preferred =
      group !== "any" ? sameNumPool.find((c) => (c.groupId || "") === group) : null;
    const chosen =
      preferred ||
      sameNumPool
        .slice()
        .sort((a, b) => String(a.groupId || "").localeCompare(String(b.groupId || "")))[0];
    return chosen || null;
  }, [listByLangAnyGroup, currentNumber, group]);

  const prevRow = useMemo(() => {
    const smaller = listByLangAnyGroup.filter((c) => toNum(c.chapter) < currentNumber);
    if (!smaller.length) return null;
    const prevNum = toNum(smaller[smaller.length - 1].chapter);
    const sameNumPool = listByLangAnyGroup.filter((c) => toNum(c.chapter) === prevNum);
    const preferred =
      group !== "any" ? sameNumPool.find((c) => (c.groupId || "") === group) : null;
    const chosen =
      preferred ||
      sameNumPool
        .slice()
        .sort((a, b) => String(a.groupId || "").localeCompare(String(b.groupId || "")))[0];
    return chosen || null;
  }, [listByLangAnyGroup, currentNumber, group]);

  const chapterNumbers = useMemo(
    () =>
      Array.from(
        new Set(
          listByLangAnyGroup
            .map((c) => c.chapter || "")
            .filter(Boolean)
        )
      ).sort((a, b) => toNum(a) - toNum(b)),
    [listByLangAnyGroup]
  );

  /* ----------------------------- URL builders ---------------------------------- */
  function buildChapterSlug(row: ChapterRow): string {
    const gid =
      row.groupId ||
      (Array.isArray(row.groups) ? row.groups[0] : null) ||
      null;
    const g = short8(gid);
    const label = encodeURIComponent(normalizeLabel(row.chapter || ""));
    const lng = (row.lang || "en").toLowerCase();
    return `g-${g}-chapter-${label}-${lng}`;
  }

  function pushToRow(row: ChapterRow | null) {
    if (!row) return;
    const chapSlug = buildChapterSlug(row);
    const base = seriesSlug || seriesId; // prefer pretty slug
    router.push(`/series/${encodeURIComponent(base || "")}/${chapSlug}`);
  }

  function goChapterByNumber(num: string) {
    const pool = listByLangAnyGroup.filter((c) => (c.chapter || "") === num);
    if (!pool.length) return;
    const preferred =
      group !== "any" ? pool.find((c) => (c.groupId || "") === group) : null;
    pushToRow(preferred || pool[0]);
  }

  /* ------------------------------ Zoom & Keys ---------------------------------- */
  const decZoom = () => setZoom((z) => Math.max(MIN_Z, +(z - STEP_Z).toFixed(1)));
  const incZoom = () => setZoom((z) => Math.min(MAX_Z, +(z + STEP_Z).toFixed(1)));
  const resetZoom = () => setZoom(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") incZoom();
      else if (e.key === "-" || e.key === "_") decZoom();
      else if (e.key === "0") resetZoom();
      else if (e.key === "ArrowLeft" && prevRow) pushToRow(prevRow);
      else if (e.key === "ArrowRight" && nextRow) saveAndGoNext();
      else if (e.key.toLowerCase() === "c") setShowComments((s) => !s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevRow?.id, nextRow?.id, group, lang]);

  /* ------------------------------ Save on Next --------------------------------- */
  async function saveAndGoNext() {
    if (!nextRow) return;
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId,
          chapterId: nextRow.id,
          chapter: nextRow.chapter ?? null,
          // no force → server forward-only check is active
        }),
      });
      const json = await res.json();
      console.log("[ChapterReader] Save result:", json);
      // notify profile/library widgets
      try {
        window.dispatchEvent(new CustomEvent("mc-reading-updated"));
      } catch { }
    } finally {
      pushToRow(nextRow);
    }
  }

  /* --------------------------------- Render ------------------------------------ */

  const availableVw = panelOpenDesktop
    ? Math.max(360, vw - (COMMENT_WIDTH + GAP_TO_PANEL) - GUTTER)
    : vw - GUTTER;
  const containerStyle: React.CSSProperties = {
    maxWidth: `${Math.min(Math.round(BASE_WIDTH * zoom), Math.round(availableVw))}px`,
    transition: "max-width 160ms ease",
  };

  return (
    <div className="relative min-h-screen bg-[#202020]">
      {/* Sticky Reader Toolbar */}
      <div
        className={`sticky top-0 z-30 backdrop-blur bg-background/80 border-b transition-transform duration-200 ${barHidden ? "-translate-y-full" : "translate-y-0"
          }`}
      >
        <div className="container mx-auto px-4 md:px-6 py-2 relative flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* Left: Chapter selector + Prev/Next */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push("/")}
              className="h-9 w-9 rounded-md border bg-background/90 hover:bg-accent active:scale-[0.98] grid place-items-center overflow-hidden cursor-pointer"
              title={t.reader.goHome}
              aria-label={t.reader.goHome}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo.png"
                alt="MakaronComiks"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain p-1"
              />
            </button>

            <label className="text-sm opacity-70">{t.reader.chapter}</label>
            <select
              className="h-9 rounded-md border bg-background text-sm min-w-28"
              value={currentRow?.chapter || ""}
              onChange={(e) => goChapterByNumber(e.target.value)}
              title="Go to chapter"
            >
              {chapterNumbers.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>

            <button
              disabled={!prevRow}
              onClick={() => pushToRow(prevRow)}
              className="h-9 px-3 rounded-md border hover:bg-accent disabled:opacity-50"
              title="Previous chapter"
              type="button"
            >
              ← {t.reader.prev}
            </button>
            <button
              disabled={!nextRow}
              onClick={saveAndGoNext}
              className="h-9 px-3 rounded-md border hover:bg-accent disabled:opacity-50"
              title="Next chapter (saves progress)"
              type="button"
            >
              {t.reader.next} →
            </button>
          </div>

          {/* Center: Series button */}
          <button
            onClick={() => {
              // Prefer robust UUID if available, else fallback to slug
              const target = seriesId && seriesId.length > 20 ? seriesId : (seriesSlug || seriesId);
              router.push(`/series/${encodeURIComponent(target)}`);
            }}
            className="mx-auto shrink-0 h-9 w-9 rounded-full border bg-background/90 hover:ring-2 hover:ring-foreground/30 overflow-hidden cursor-pointer"
            title={`Go to series: ${seriesTitle}`}
            aria-label={`Go to series: ${seriesTitle}`}
            type="button"
          >
            {seriesCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seriesCover} alt={seriesTitle} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs px-2 leading-9 text-center block">
                {seriesTitle.slice(0, 2).toUpperCase()}
              </span>
            )}
          </button>

          {/* Right: Group / Comments / Lang */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <label className="text-sm opacity-70">{t.reader.group}</label>
              <select
                className="h-9 rounded-md border bg-background text-sm min-w-40"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                title="Filter by scanlation group"
              >
                {groupsForLang.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowComments(true)}
              className="hidden md:inline-flex h-9 px-4 rounded-md border bg-background/90 backdrop-blur hover:bg-accent shadow-sm cursor-pointer select-none transition active:scale-[0.98] items-center justify-center gap-2"
              title="Open comments (C)"
              type="button"
            >
              <span aria-hidden>💬</span>
              <span className="leading-none">{t.reader.comments}</span>
            </button>

            <div className="flex items-center gap-2">
              <label className="text-sm opacity-70">{t.reader.lang}</label>
              <select
                className="h-9 rounded-md border bg-background text-sm"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                title="Filter language"
              >
                {langs.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Images */}
      <div
        className="container mx-auto px-4 md:px-6 py-4"
        style={{
          marginRight: panelOpenDesktop ? COMMENT_WIDTH + GAP_TO_PANEL : undefined,
          transition: "margin-right 160ms ease",
        }}
      >
        <div className="mx-auto space-y-1" style={containerStyle}>
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`Page ${i + 1}`}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              className="w-full h-auto bg-muted/10 block"
            />
          ))}
        </div>
      </div>

      {/* Zoom controller */}
      <div className="fixed left-4 bottom-4 z-40">
        <div className="flex items-center gap-2 rounded-full border bg-background/90 backdrop-blur px-2 py-1 shadow">
          <button
            onClick={decZoom}
            className="h-9 w-9 rounded-full border hover:bg-accent grid place-items-center cursor-pointer"
            title="Zoom out ( - )"
            type="button"
          >
            –
          </button>
          <button
            onClick={resetZoom}
            className="h-9 px-3 rounded-full border hover:bg-accent text-sm cursor-pointer"
            title="Reset zoom ( 0 )"
            type="button"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={incZoom}
            className="h-9 w-9 rounded-full border hover:bg-accent grid place-items-center cursor-pointer"
            title="Zoom in ( + )"
            type="button"
          >
            +
          </button>
        </div>
      </div>

      {/* Comments panel (desktop) */}
      {showComments && (
        <>
          <div
            className="hidden md:block fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowComments(false)}
          />
          <aside
            className="hidden md:flex fixed top-0 right-0 h-screen z-50 border-l bg-background shadow-xl"
            style={{ width: COMMENT_WIDTH }}
            aria-label="Comments panel"
          >
            <div className="flex-1 flex flex-col">
              <div className="h-12 border-b flex items-center justify-between px-3">
                <strong>{t.reader.comments}</strong>
                <button
                  onClick={() => setShowComments(false)}
                  className="h-8 px-3 rounded-md border hover:bg-accent cursor-pointer"
                  title="Close"
                  type="button"
                >
                  ✕
                </button>
              </div>
              <div className="p-3 text-sm opacity-80">
                <p>This is a placeholder for the comments UI (desktop panel).</p>
                <ul className="list-disc ml-5 mt-3 space-y-2">
                  <li>Sign in to comment (later)</li>
                  <li>Sort by newest / top (later)</li>
                </ul>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Mobile comments section */}
      <section className="md:hidden container mx-auto px-4 md:px-6 pb-10">
        <div className="mt-6 rounded-xl border">
          <div className="h-12 border-b flex items-center px-3">
            <strong>{t.reader.comments}</strong>
          </div>
          <div className="p-3 text-sm opacity-80">
            <p>Mobile comments placeholder. Backend will be connected later.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
