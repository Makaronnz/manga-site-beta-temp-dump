/** info: Smart Start/Continue button for MakaronComiks Series page.
 * - Checks follow status (/api/follow?seriesId=...) and last read (/api/reading/last?seriesId=...).
 * - If status !== "Unfollow" and last.chapterId exists, resolves that chapter via:
 *      1) GET /api/series/chapters?byChapterId=<chapterId>  (fast path)
 *      2) Fallback: GET /api/series/chapters?id=<seriesKey>&lang=any&group=all&limit=1000 and find by id.
 * - Builds canonical reader slug: g-<short8(groupId)>-chapter-<normalizedLabel>-<lang>
 *   (normalizedLabel follows server logic: "Oneshot" -> "oneshot", keep dots; URL-encode on server)
 * - Otherwise falls back to the first chapter (passed from parent).
 */

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FollowStatus =
  | "Reading"
  | "Completed"
  | "On-Hold"
  | "Dropped"
  | "Plan to Read"
  | "Unfollow"
  | string;

type FollowResp = { status?: FollowStatus | null };

type LastReadResp = {
  chapterId?: string | number | null;
  chapter?: string | number | null;
};

type ChapterLite = {
  id: string | number;
  chapter?: string | number | null;
  lang?: string | null;
  groupId?: string | number | null;
};

type ChaptersSingleResp = {
  item?: {
    id: string | number;
    chapter?: string | number | null;
    lang?: string | null;
    groupId?: string | number | null;
  } | null;
};

type ChaptersListResp = {
  items?: {
    id: string | number;
    chapter?: string | number | null;
    lang?: string | null;
    groupId?: string | number | null;
  }[];
};

type Props = {
  /** slug OR mdId used under /series/<seriesKey>/... */
  seriesKey: string;
  /** first chapter fallback for "Start Reading" */
  firstChapter?: ChapterLite | null;
  /** optional styling */
  className?: string;
  /** optional custom children (icon/text) */
  children?: React.ReactNode;
};

function short8(id?: string | number | null): string {
  const s = (id == null ? "" : String(id)).replace(/-/g, "");
  return s.slice(0, 8) || "unknown";
}

/** Server's page.tsx normalizes to "oneshot" and otherwise keeps raw label (then encodeURIComponent on server). */
function normalizeLabelLikeServer(label?: string | number | null): string {
  if (label == null) return "oneshot";
  const raw = String(label).trim();
  if (/^one[-\s]?shot$/i.test(raw)) return "oneshot";
  return raw; // keep dots, etc.; server encodes on its side
}

function buildCanonicalSlug(groupId: string | number | null | undefined, label: string | number | null | undefined, lang?: string | null) {
  const g = short8(groupId);
  const l = normalizeLabelLikeServer(label);
  const lng = (lang || "en").toLowerCase();
  // server applies encodeURIComponent to label; we keep the raw here, server route will accept this pattern
  return `g-${g}-chapter-${l}-${lng}`;
}

async function j<T>(r: Response): Promise<T | null> {
  try { return (await r.json()) as T; } catch { return null; }
}

export default function StartContinueButton({ seriesKey, firstChapter, className, children }: Props) {
  const [href, setHref] = useState<string>("#");
  const [label, setLabel] = useState<"Start Reading" | "Continue Reading">("Start Reading");
  const [loading, setLoading] = useState<boolean>(true);

  const startHrefFallback = useMemo(() => {
    if (!firstChapter?.id) return `/series/${seriesKey}`;
    // generic legacy fallback by id (works even if canonical slug cannot be built)
    return `/series/${seriesKey}/chapter/${firstChapter.id}`;
  }, [seriesKey, firstChapter]);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        // 1) follow status
        const f = await fetch(`/api/follow?seriesId=${encodeURIComponent(seriesKey)}`, { credentials: "include" });
        const fjs = await j<FollowResp>(f);
        const status = (fjs?.status ?? "Unfollow") as FollowStatus;

        // 2) last read
        const r = await fetch(`/api/reading/last?seriesId=${encodeURIComponent(seriesKey)}`, { credentials: "include" });
        const rjs = await j<LastReadResp>(r);
        const lastId = rjs?.chapterId ?? null;
        const lastLabel = rjs?.chapter ?? null;

        if (status !== "Unfollow" && lastId != null) {
          // 3) FAST PATH: single chapter resolve
          let resolved: ChapterLite | null = null;

          try {
            const s = await fetch(`/api/series/chapters?byChapterId=${encodeURIComponent(String(lastId))}`, { credentials: "include" });
            if (s.ok) {
              const sjs = await j<ChaptersSingleResp>(s);
              if (sjs?.item?.id) {
                resolved = {
                  id: sjs.item.id,
                  chapter: sjs.item.chapter ?? lastLabel,
                  lang: sjs.item.lang ?? "en",
                  groupId: sjs.item.groupId ?? null,
                };
              }
            }
          } catch { /* ignore */ }

          // 4) FALLBACK: wide query & find by id
          if (!resolved) {
            try {
              const w = await fetch(
                `/api/series/chapters?id=${encodeURIComponent(seriesKey)}&lang=any&group=all&limit=1000`,
                { credentials: "include" }
              );
              if (w.ok) {
                const wjs = await j<ChaptersListResp>(w);
                const found = (wjs?.items || []).find((x) => String(x.id) === String(lastId)) || null;
                if (found) {
                  resolved = {
                    id: found.id,
                    chapter: (found.chapter ?? lastLabel),
                    lang: found.lang ?? "en",
                    groupId: found.groupId ?? null,
                  };
                }
              }
            } catch { /* ignore */ }
          }

          // 5) Build canonical href (or legacy by id)
          if (resolved) {
            const slug = buildCanonicalSlug(resolved.groupId, resolved.chapter ?? lastLabel, resolved.lang || "en");
            if (alive) {
              setHref(`/series/${seriesKey}/${slug}`);
              setLabel("Continue Reading");
              setLoading(false);
              return;
            }
          }

          if (alive) {
            setHref(`/series/${seriesKey}/chapter/${lastId}`);
            setLabel("Continue Reading");
            setLoading(false);
            return;
          }
        }

        // Default: Start
        if (alive) {
          setHref(startHrefFallback);
          setLabel("Start Reading");
          setLoading(false);
        }
      } catch {
        if (alive) {
          setHref(startHrefFallback);
          setLabel("Start Reading");
          setLoading(false);
        }
      }
    }

    run();
    return () => { alive = false; };
  }, [seriesKey, startHrefFallback]);

  return (
    <Link
      href={href}
      aria-disabled={loading}
      className={
        className ??
        "inline-flex items-center justify-center h-10 px-4 rounded-md border hover:bg-accent transition"
      }
      title={label}
    >
      {children ?? (
        <>
          <i className="fa-solid fa-book-open mr-2" />
          {loading ? "Loading…" : label}
        </>
      )}
    </Link>
  );
}
