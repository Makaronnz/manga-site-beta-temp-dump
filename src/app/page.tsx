// src/app/page.tsx
/**
 * info:
 * MakaronComiks home page.
 * - Renders Hero, Followed Updates, Reading History (Client)
 * - Renders Popular & Newest rails with Suspense (Streaming)
 */
export const runtime = "nodejs"; // SSR – Node runtime

import { getUserSettings } from "@/lib/settings-server";
import { type Rating } from "@/index";
import { Suspense } from "react";
import HeroSection from "@/components/HeroSection";
import FollowedUpdates from "@/components/FollowedUpdates";
import ReadingHistory from "@/components/ReadingHistory";
import RecentUpdates from "@/components/RecentUpdates";
import PopularRail from "@/components/home/PopularRail";
import NewestRail from "@/components/home/NewestRail";
import { type Lang, DICT } from "@/lib/i18n";

function RailSkeleton({ title }: { title: string }) {
  return (
    <section className="container mx-auto px-4 md:px-6 py-6 opacity-60">
      <div className="mb-3">
        <h2 className="text-xl md:text-2xl font-semibold">{title}</h2>
      </div>
      <div className="flex gap-4 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="w-[180px] h-[260px] bg-muted/20 rounded-xl animate-pulse" />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const settings = await getUserSettings();
  const t = DICT[settings.lang as Lang] || DICT.en;

  const ratings: Rating[] = settings.nsfw
    ? ["safe", "suggestive", "erotica", "pornographic"]
    : ["safe", "suggestive"];

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        <HeroSection />

        {/* Followed Updates (Client - DB) */}
        <FollowedUpdates />

        {/* Reading History (Client - Browser) */}
        <ReadingHistory limit={24} title={t.home.readingHistory} />

        {/* Popular (Streaming) */}
        <Suspense fallback={<RailSkeleton title={t.home.popular30d} />}>
          <PopularRail
            title={t.home.popular30d}
            ratings={ratings}
            blocked={settings.blocked}
            lang={settings.contentLang}
          />
        </Suspense>

        {/* Newest (Streaming) */}
        <Suspense fallback={<RailSkeleton title={t.home.newComics} />}>
          <NewestRail
            title={t.home.newComics}
            ratings={ratings}
            blocked={settings.blocked}
            lang={settings.contentLang}
          />
        </Suspense>

        <RecentUpdates lang={settings.contentLang} title={t.home.latestUpdates} blocked={settings.blocked} />
      </main>
    </div>
  );
}
