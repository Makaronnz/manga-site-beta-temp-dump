
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import SeriesChaptersClient from "@/components/SeriesChaptersClient";
import { EXCLUDED_MANGA_IDS } from "@/lib/filters";
import FollowControl from "@/components/FollowControl";
import StartContinueButton from "@/components/StartContinueButton";
import { getSeriesDetails, type SeriesDetails } from "@/lib/series-controller";
import { getSeriesChapters } from "@/lib/chapters-controller";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { ongoing: "Ongoing", completed: "Completed", hiatus: "Hiatus", cancelled: "Cancelled" };

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const raw = params.id.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
  const { data } = await getSeriesDetails(isUuid ? raw : "", isUuid ? "" : raw);

  if (!data || !data.title) return { title: "Series Not Found" };

  return {
    title: `${data.title} - MakaronComiks`,
    description: data.description?.slice(0, 160) ?? `Read ${data.title} on MakaronComiks`,
    openGraph: {
      title: data.title,
      description: data.description?.slice(0, 160),
      images: data.cover ? [data.cover] : [],
    }
  };
}

export default async function SeriesPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; group?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const raw = params.id.trim();

  // Check excluded
  if (EXCLUDED_MANGA_IDS.has(raw.toLowerCase())) notFound();

  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("mc_lang")?.value;
  const wantedLang = (searchParams?.lang || cookieLang || "en").toLowerCase();
  const wantedGroup = (searchParams?.group || "all").toLowerCase();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);

  // Fetch details & chapters directly
  const [detailsRes, chaptersData] = await Promise.all([
    getSeriesDetails(isUuid ? raw : "", isUuid ? "" : raw),
    getSeriesChapters(raw, {
      lang: wantedLang,
      group: wantedGroup,
      limit: 100
    })
  ]);

  // Handle details response
  if (detailsRes.status === 404 || detailsRes.error === "not_found") {
    notFound();
  }
  const series = detailsRes.data;
  if (!series || !series.title) notFound();

  const items = chaptersData?.items ?? [];
  const availableLangs = chaptersData?.availableLangs ?? [];
  // extracting unique groups from items for the client dropdown if needed, 
  // though previously it seemed to define 'groups' but api didn't return it.
  // We can construct it from items if we want to be helpful, but let's stick to what we have.
  // Actually, SeriesChaptersClient might expect `groups` to populate a dropdown. 
  // Since the API didn't return it, the dropdown was likely empty. 
  // We can improve this slightly by generating it from the items we have.
  const groupsRaw = new Map<string, string>();
  items.forEach(i => {
    if (i.groupId) groupsRaw.set(i.groupId, i.groupName || i.groupShort);
  });
  const groups = Array.from(groupsRaw.entries()).map(([id, name]) => ({ id, name }));

  const firstChapter = items[0] || null;
  const seriesKey = series.id;

  return (
    <div className="container mx-auto px-4 md:px-6 py-8">
      <div className="flex gap-6">
        <div className="w-[220px] sm:w-[280px] shrink-0">
          <div className="relative w-full pb-[150%] rounded-xl overflow-hidden border bg-muted/10">
            {series.cover ? (
              <Image src={series.cover} alt={series.title} fill unoptimized sizes="(max-width: 640px) 220px, (max-width: 768px) 280px, 280px" className="object-cover" priority />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-xs opacity-60">No Image</div>
            )}
          </div>
        </div>

        <div className="grow min-w-0">
          <h1 className="text-3xl md:text-4xl font-semibold mb-3 break-words">{series.title}</h1>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="inline-flex items-center gap-1 h-8 px-3 rounded-full border text-sm">
              <i className="fa-solid fa-book-open opacity-70" /> {series.type}
            </span>
            {series.demographic && (
              <span className="inline-flex items-center gap-1 h-8 px-3 rounded-full border text-sm">
                <i className="fa-solid fa-user-group opacity-70" /> {series.demographic[0]?.toUpperCase() + series.demographic.slice(1)}
              </span>
            )}
            {series.status && (
              <span className="inline-flex items-center gap-1 h-8 px-3 rounded-full border text-sm">
                <i className="fa-regular fa-circle-dot opacity-70" /> {STATUS_LABEL[series.status] ?? series.status}
              </span>
            )}
            {series.year && (
              <span className="inline-flex items-center gap-1 h-8 px-3 rounded-full border text-sm">
                <i className="fa-regular fa-calendar opacity-70" /> {series.year}
              </span>
            )}
            {series.originalLanguage && (
              <span className="inline-flex items-center gap-1 h-8 px-3 rounded-full border text-sm">
                <i className="fa-solid fa-globe opacity-70" /> {series.originalLanguage.toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {[...series.genres, ...series.themes, ...series.formats].slice(0, 10).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 h-6 px-2.5 rounded-md bg-accent/50 text-xs font-medium opacity-80">
                {tag}
              </span>
            ))}
          </div>

          {series.externalLinks && series.externalLinks.length > 0 && (
            <>
              <div className="mb-2 text-sm font-medium opacity-90">Referrers</div>
              <div className="mb-4 flex flex-wrap gap-2">
                {series.externalLinks.map((lnk) => (
                  <a key={lnk.key} href={lnk.url} target="_blank" rel="noopener noreferrer" className="h-8 px-3 rounded-md border text-xs hover:bg-accent underline-offset-4" title={lnk.name}>
                    {lnk.name}
                  </a>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <StartContinueButton
              seriesKey={seriesKey}
              firstChapter={
                firstChapter
                  ? { id: firstChapter.id, chapter: firstChapter.chapter, lang: firstChapter.lang, groupId: firstChapter.groupId ?? null }
                  : null
              }
              className="inline-flex items-center justify-center h-10 px-4 rounded-md border hover:bg-accent transition"
            >
              <>
                <i className="fa-solid fa-book-open mr-2" />
                Start / Continue
              </>
            </StartContinueButton>

            <FollowControl seriesId={seriesKey} title={series.title} coverUrl={series.cover ?? undefined} />
          </div>

          {series.description && (
            <p className="mt-5 text-base md:text-lg leading-relaxed md:leading-7 opacity-90 max-w-4xl whitespace-pre-wrap">
              {series.description}
            </p>
          )}
        </div>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-3">Chapters</h2>
      <SeriesChaptersClient
        seriesId={seriesKey}
        items={items as any}
        availableLangs={availableLangs}
        selectedLang={wantedLang}
        groups={groups}
        selectedGroup={wantedGroup}
      />
    </div>
  );
}
