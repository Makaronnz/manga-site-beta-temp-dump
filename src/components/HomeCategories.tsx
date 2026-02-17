// src/components/HomeCategories.tsx
"use client";

import { useEffect, useState } from "react";
import MangaCard from "@/components/MangaCard";
import type { Manga } from "@/index";

type Props = {
  popular: Manga[];
  fresh: Manga[];
  initialTab?: "popular" | "fresh";
};

export default function HomeCategories({ popular, fresh, initialTab = "popular" }: Props) {
  const [tab, setTab] = useState<"popular" | "fresh">("popular");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const list = tab === "popular" ? popular : fresh;

  return (
    <section className="container mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("popular")}
          className={`rounded-full px-4 h-10 border text-sm transition ${
            tab === "popular" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          }`}
          aria-pressed={tab === "popular"}
        >
          Recent popular
        </button>
        <button
          onClick={() => setTab("fresh")}
          className={`rounded-full px-4 h-10 border text-sm transition ${
            tab === "fresh" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          }`}
          aria-pressed={tab === "fresh"}
        >
          New comics
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-6">
        {list.map((m) => (
          <MangaCard key={m.id} manga={m} />
        ))}
      </div>
    </section>
  );
}
