// /src/server/sources/mal.ts
import type { SourceAdapter, SeriesMeta, ChapterMeta, PageMeta } from "./base";

const CLIENT_ID = process.env.MAL_CLIENT_ID!;

export const MALAdapter: SourceAdapter = {
  key: "mal",
  async fetchSeriesMeta(malId: string): Promise<SeriesMeta> {
    const resp = await fetch(
      `https://api.myanimelist.net/v2/manga/${malId}?fields=title,alternative_titles,start_date,status,synopsis,main_picture`,
      { headers: { "X-MAL-CLIENT-ID": CLIENT_ID } }
    );
    if (!resp.ok) throw new Error("MAL meta failed");
    const j = await resp.json();

    return {
      title: j.title,
      altTitles: Object.values(j.alternative_titles || {}).flat().filter(Boolean),
      description: j.synopsis || undefined,
      coverUrl: j.main_picture?.large || j.main_picture?.medium,
      year: j.start_date ? Number(j.start_date.split("-")[0]) : undefined,
      status: j.status,
      lang: "jp",
      externalId: String(malId),
      externalUrl: `https://myanimelist.net/manga/${malId}`
    };
  },
  async fetchChapters(): Promise<ChapterMeta[]> { return []; },
  async fetchPages(): Promise<PageMeta[]> { return []; }
};
