// src/components/HomeRail.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useMemo } from "react";
import { filterOutExcluded } from "@/lib/filters";

export type RailItem = {
  id: string;
  title: string;
  description: string; // not used anymore on the card (özeti göstermiyoruz)
  cover: string | null;
  lang?: string;
};

import { FlagIcon } from "./FlagIcon";

export default function HomeRail({
  title,
  items,
}: {
  title: string;
  items: RailItem[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Global kara liste güvenliği
  const safeItems = useMemo(() => filterOutExcluded(items ?? []), [items]);

  function scrollBy(dir: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }

  return (
    <section className="container mx-auto px-4 md:px-6 py-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-semibold">{title}</h2>

        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollBy("left")}
            className="h-9 w-9 rounded-full border hover:bg-accent flex items-center justify-center"
            aria-label="Scroll left"
          >
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy("right")}
            className="h-9 w-9 rounded-full border hover:bg-accent flex items-center justify-center"
            aria-label="Scroll right"
          >
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent" />

        <div ref={scrollerRef} className="no-scrollbar overflow-x-auto scroll-smooth">
          <ol className="flex gap-4 pr-2">
            {safeItems.map((m, idx) => (
              <li key={m.id} className="w-[200px] shrink-0">
                <Link href={`/series/${m.id}`} className="group block">
                  <div className="relative w-full pb-[140%] rounded-2xl overflow-hidden border bg-muted/10">
                    {/* Kapak */}
                    {m.cover ? (
                      <Image
                        src={m.cover}
                        alt={m.title}
                        fill
                        sizes="200px"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
                        No Image
                      </div>
                    )}

                    {/* Sıra rozeti */}
                    <span
                      className={[
                        "absolute top-2 left-2 h-7 min-w-7 px-2",
                        "rounded-md bg-black/70 text-white text-xs",
                        "grid place-items-center font-semibold",
                      ].join(" ")}
                    >
                      {idx + 1}
                    </span>

                    {/* Dil Bayrağı */}
                    {m.lang && (
                      <div className="absolute top-2 left-10 h-7 w-9 rounded-md overflow-hidden shadow-sm">
                        <FlagIcon lang={m.lang} className="w-full h-full" />
                      </div>
                    )}

                    {/* Hover 'Read' etiketi */}
                    <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition">
                      <span className="rounded-full bg-black/80 text-white text-[11px] px-2 py-1">Read →</span>
                    </div>
                  </div>

                  {/* Başlık (kapak altı, 2 satır kısıt) */}
                  <div className="p-2">
                    <h3 className="text-sm font-medium line-clamp-2">{m.title}</h3>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>

        {/* mobile oklar */}
        <div className="sm:hidden mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => scrollBy("left")}
            className="h-9 w-9 rounded-full border hover:bg-accent flex items-center justify-center"
            aria-label="Scroll left"
          >
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy("right")}
            className="h-9 w-9 rounded-full border hover:bg-accent flex items-center justify-center"
            aria-label="Scroll right"
          >
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
      </div>
    </section>
  );
}
