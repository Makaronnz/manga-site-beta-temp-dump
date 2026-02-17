// src/components/ProfileOwnLibrary.tsx
/**
 * INFO:
 * Profile → “Your Library” grid (overview).
 * - Loads your followed series from /api/follow and last-read map from /api/reading.
 * - Shows **progress as `current / total`** (current is numeric parse of last-read label/id).
 * - Fetches **total chapter count** per series (EN by default) from /api/series/chapters
 *   with a light query (only to get pagination total). If total is unknown, shows “–”.
 * - If a series status is **Completed**, the UI displays `total / total`
 *   (does NOT overwrite DB progress; purely a view concern here).
 * - Links use `/series/<seriesId>` fallback (slug-aware server should redirect);
 *   if you prefer strict slugs, we can switch once the API returns slugs.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type FollowStatus = "Reading" | "Completed" | "On-Hold" | "Dropped" | "Plan to Read";

type Entry = {
  seriesId: string;              // numeric id (stringified)
  status: FollowStatus;
  title?: string | null;
  coverUrl?: string | null;
  updatedAt?: string | null;
};

type Progress = {
  chapterId: string;
  chapter?: string | null;       // human label like "5.5"
  updatedAt: string;
};

function parseNumericProgress(p?: Progress): number | null {
  if (!p) return null;
  const src = (p.chapter && String(p.chapter).trim()) || (p.chapterId && String(p.chapterId).trim()) || "";
  const digits = (src.match(/[\d.]+/g) || []).join("");
  if (!digits) return null;
  const n = parseFloat(digits);
  return Number.isFinite(n) ? n : null;
}

export default function ProfileOwnLibrary() {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // ---- data loader ----------------------------------------------------------
  async function load() {
    setLoading(true);
    try {
      // 1) library entries (numeric series ids)
      const r = await fetch("/api/follow", { cache: "no-store" });
      const j = await r.json();
      const eMap: Record<string, Entry> = j?.entries ?? {};
      const ids = Object.keys(eMap);

      // 2) reading progress (server already canonicalizes keys to numeric ids)
      let prog: Record<string, Progress> = {};
      if (ids.length) {
        const r2 = await fetch(`/api/reading?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" });
        const j2 = await r2.json();
        prog = j2?.progress ?? {};
      }

      setEntries(eMap);
      setProgress(prog);

      // 3) totals per series (by preferred lang = EN here)
      const nextTotals: Record<string, number> = {};
      // Fetch in small batches to avoid spamming the API
      const BATCH = 8;
      for (let i = 0; i < ids.length; i += BATCH) {
        const slice = ids.slice(i, i + BATCH);
        await Promise.all(
          slice.map(async (sid) => {
            try {
              // We only need the pagination summary; keep payload tiny.
              const res = await fetch(
                `/api/series/chapters?seriesId=${encodeURIComponent(sid)}&lang=EN&page=1&limit=1`,
                { cache: "no-store" }
              );
              const data = await res.json().catch(() => null as any);
              // Prefer an explicit `total`; else fall back to items length if present.
              const total: number | null =
                (typeof data?.total === "number" && data.total >= 0 && data.total) ||
                (Array.isArray(data?.items) ? data.items.length : null);
              if (total !== null) nextTotals[sid] = total;
            } catch {
              /* ignore per-series errors */
            }
          })
        );
      }
      setTotals((prev) => ({ ...prev, ...nextTotals }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
    })();

    // Reader / FollowControl triggers
    const onUpdate = () => {
      if (!alive) return;
      load();
    };
    window.addEventListener("mc-follow-updated" as any, onUpdate);
    window.addEventListener("mc-reading-updated" as any, onUpdate);
    return () => {
      alive = false;
      window.removeEventListener("mc-follow-updated" as any, onUpdate);
      window.removeEventListener("mc-reading-updated" as any, onUpdate);
    };
  }, []);

  const items = useMemo(() => {
    return Object.values(entries).sort(
      (a, b) => Date.parse(b.updatedAt || "0") - Date.parse(a.updatedAt || "0")
    );
  }, [entries]);

  if (loading) return <p className="opacity-70">Loading…</p>;
  if (!items.length) return <p className="opacity-80">No saved series yet.</p>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      {items.map((it) => {
        const pg = progress[it.seriesId];
        const currentRaw = parseNumericProgress(pg);
        const total = totals[it.seriesId];
        // “Completed” overrides only the DISPLAY, not the DB progress
        const current =
          it.status === "Completed" && typeof total === "number"
            ? total
            : currentRaw ?? 0;

        const title = (it.title ?? "").trim() || "Untitled";
        const cover =
          it.coverUrl && it.coverUrl.startsWith("/")
            ? it.coverUrl
            : it.coverUrl || "/placeholder-cover.png";

        return (
          <div key={it.seriesId} className="group rounded-md overflow-hidden border border-border/60 bg-card">
            <Link href={`/series/${encodeURIComponent(it.seriesId)}`} className="block">
              <div className="relative w-full aspect-[3/4] bg-muted">
                <Image
                  src={cover}
                  alt={title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 16vw"
                  className="object-cover group-hover:scale-[1.01] transition"
                />
                {/* progress pill on cover */}
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[11px] bg-black/70 text-white">
                  {typeof total === "number" ? `${current} / ${total}` : currentRaw ?? "—"}
                </div>
              </div>
            </Link>
            <div className="p-2">
              <Link
                href={`/series/${encodeURIComponent(it.seriesId)}`}
                className="line-clamp-1 font-medium hover:underline"
                title={title}
              >
                {title}
              </Link>
              <div className="mt-1 text-xs flex items-center justify-between opacity-80">
                <span>{it.status}</span>
                {pg?.chapter || pg?.chapterId ? (
                  <span title={`Last read: ${pg.chapter || pg.chapterId}`}>
                    Ch. {pg.chapter || pg.chapterId}
                  </span>
                ) : (
                  <span className="opacity-50">—</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
