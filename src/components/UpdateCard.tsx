// src/components/UpdateCard.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { timeAgo, formatUTC } from "@/lib/time";
import { FlagIcon } from "./FlagIcon";

/**
 * Feed item coming from "followed updates" API.
 * To generate canonical URLs directly, include `slug`, `groupShort`, and `lang`.
 * If those are absent, we gracefully fallback to the legacy redirecting URLs.
 */
export type FollowedItem = {
  // Legacy fields
  mangaId: string;              // MD UUID or internal ref used for legacy links
  chapterId?: string;           // MD chapter UUID (optional if canonical present)

  // Display
  title: string;
  chapter: string | null;       // label like "12.5" or null for oneshot
  cover: string | null;
  publishAt: string | null;

  // Canonical-friendly extras (optional but recommended)
  slug?: string | null;         // series slug in our DB
  lang?: string | null;         // "en", "tr", ...
  groupShort?: string | null;   // short of scanlation group, e.g. "sg"
};

function buildCanonicalHref(item: FollowedItem): string | null {
  const slug = (item.slug || "").trim();
  const label = (item.chapter || "").trim();
  const lang = (item.lang || "").trim().toLowerCase();
  const g = (item.groupShort || "").trim().toLowerCase();
  if (!slug || !label || !lang || !g) return null;
  return `/series/${encodeURIComponent(slug)}/g-${encodeURIComponent(g)}-chapter-${encodeURIComponent(
    label
  )}-${encodeURIComponent(lang)}`;
}

export default function UpdateCard({
  item,
  priority = false,
}: {
  item: FollowedItem;
  priority?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cover =
    item.cover && item.cover.trim().length > 0 ? item.cover : "/placeholder-cover.png";

  const title = (item.title || "").trim() || "Untitled";
  const chapterLabel = item.chapter ? `Ch. ${item.chapter}` : "New chapter";

  // Prefer canonical URL if possible
  const canonical = buildCanonicalHref(item);
  const href =
    canonical ||
    (item.chapterId
      ? `/series/${encodeURIComponent(item.mangaId)}/chapter/${encodeURIComponent(item.chapterId)}`
      : `/series/${encodeURIComponent(item.mangaId)}`);

  // Series title URL: prefer slug if available
  const seriesHref = item.slug
    ? `/series/${encodeURIComponent(item.slug)}`
    : `/series/${encodeURIComponent(item.mangaId)}`;

  const tIso = item.publishAt || null;

  return (
    <div className="group rounded-md overflow-hidden border bg-card">
      <Link href={href} className="block">
        <div className="relative w-full aspect-[3/4] bg-muted">
          <Image
            src={cover}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 16vw"
            className="object-cover transition-transform group-hover:scale-[1.01]"
            priority={priority}
          />



          {/* Chapter badge */}
          <div className="absolute left-2 top-2 rounded-md bg-background/80 backdrop-blur px-2 py-1 text-[11px] border">
            {chapterLabel}
          </div>

          {/* Language Flag (NEW) */}
          {item.lang && (
            <div className="absolute right-2 top-2 w-5 h-3.5 rounded-sm overflow-hidden shadow-sm border border-black/10">
              <FlagIcon lang={item.lang} className="w-full h-full" />
            </div>
          )}
        </div>
      </Link>

      <div className="p-2">
        <Link
          href={seriesHref}
          className="line-clamp-1 font-medium hover:underline"
          title={title}
        >
          {title}
        </Link>

        <div className="mt-1 text-xs flex items-center justify-between opacity-80">
          <span className="line-clamp-1" title={chapterLabel}>
            {chapterLabel}
          </span>

          {tIso ? (
            <time
              title={formatUTC(tIso)} // SSR/Client consistent title
              dateTime={new Date(tIso).toISOString()}
              suppressHydrationWarning
            >
              {mounted ? timeAgo(tIso, "en") : formatUTC(tIso)}
            </time>
          ) : (
            <span>—</span>
          )}
        </div>
      </div>
    </div>
  );
}
