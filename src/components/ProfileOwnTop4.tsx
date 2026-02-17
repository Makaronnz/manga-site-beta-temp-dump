"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";

type Entry = {
  seriesId: string;
  status: "Reading" | "Completed" | "On-Hold" | "Dropped" | "Plan to Read";
  title?: string | null;
  coverUrl?: string | null;
  updatedAt?: string | null;
};

export default function ProfileOwnTop4() {
  const { t } = useLang();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/follow", { cache: "no-store" });
      const j = await r.json();
      setEntries(j?.entries ?? {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
    })();

    // Reader/Follow değişince anında güncelle
    const onUpdate = () => { if (alive) load(); };
    window.addEventListener("mc-follow-updated" as any, onUpdate);

    return () => {
      alive = false;
      window.removeEventListener("mc-follow-updated" as any, onUpdate);
    };
  }, []);

  const items = useMemo(() => {
    return Object.values(entries)
      .sort((a, b) => Date.parse(b.updatedAt || "0") - Date.parse(a.updatedAt || "0"))
      .slice(0, 4);
  }, [entries]);

  if (loading) return <div className="opacity-70 mt-4">{t.common.loading}</div>;
  if (!items.length) return <div className="opacity-80 mt-4">{t.profile.emptyLib}</div>;

  return (
    <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((s) => {
        const cover =
          s.coverUrl && s.coverUrl.startsWith("/")
            ? s.coverUrl
            : s.coverUrl || "/placeholder-cover.png";
        const title = (s.title ?? "").trim() || t.common.untitled;

        return (
          <li key={s.seriesId} className="group">
            <Link href={`/series/${encodeURIComponent(s.seriesId)}`} className="block">
              <div className="relative w-full aspect-[3/4] rounded-md overflow-hidden border border-border/60">
                <Image
                  src={cover}
                  alt={title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
                  className="object-cover group-hover:scale-[1.02] transition"
                />
              </div>
              <div className="mt-2 text-sm font-medium line-clamp-1" title={title}>
                {title}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
