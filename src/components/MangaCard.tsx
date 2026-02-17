/** info: <MangaCard/> – shared cover card for series tiles (Favorites, Library, listings).
 * - Backwards compatible: same API plus optional props to fine-tune usage.
 * - Smart href: uses slug if present, falls back to numeric/UUID id.
 * - Compact mode for tight grids (e.g., Favorites on profile).
 *
 * File: src/components/MangaCard.tsx
 */

"use client";

import Image from "next/image";
import Link from "next/link";

export type Manga = {
  id: string;               // numeric/uuid fallback id
  title: string;
  cover: string | null;
  altTitle?: string;
  slug?: string;            // canonical slug if available
};

type Props = {
  manga: Manga;
  /** render smaller paddings/text for dense grids (favorites) */
  compact?: boolean;
  /** override target URL if you need to link somewhere else */
  hrefOverride?: string;
  /** pass true for LCP element in above-the-fold sections */
  priority?: boolean;
  /** optional extra below title (e.g., progress “12 / 58”) */
  belowTitle?: React.ReactNode;
};

export default function MangaCard({
  manga,
  compact = false,
  hrefOverride,
  priority = false,
  belowTitle,
}: Props) {
  const href = hrefOverride || `/series/${manga.slug ?? manga.id}`;
  const paddingClass = compact ? "p-2" : "p-3";
  const titleClass = compact ? "text-[13px]" : "text-sm";

  return (
    <Link
      href={href}
      className="group block rounded-xl overflow-hidden border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors"
      title={manga.title}
      aria-label={manga.title}
    >
      <div className="relative w-full pb-[150%]">
        {manga.cover ? (
          <Image
            src={manga.cover}
            alt={manga.title}
            fill
            sizes="(max-width:640px) 45vw, (max-width:1024px) 22vw, 220px"
            className="object-cover group-hover:scale-[1.02] transition-transform"
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
            No Image
          </div>
        )}
      </div>

      <div className={paddingClass}>
        <h3 className={`${titleClass} font-medium leading-snug line-clamp-2`}>
          {manga.title}
        </h3>
        {manga.altTitle ? (
          <div className="mt-0.5 text-[11px] opacity-70 line-clamp-1">{manga.altTitle}</div>
        ) : null}
        {belowTitle ? <div className="mt-1 text-xs opacity-80">{belowTitle}</div> : null}
      </div>
    </Link>
  );
}
