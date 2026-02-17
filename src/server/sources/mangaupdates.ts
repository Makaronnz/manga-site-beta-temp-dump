// /src/server/sources/mangaupdates.ts
import type { SourceAdapter, SeriesMeta, ChapterMeta, PageMeta } from "./base";

export const MUAdapter: SourceAdapter = {
  key: "mangaupdates",
  async fetchSeriesMeta(muId: string): Promise<SeriesMeta> {
    const url = `https://www.mangaupdates.com/series.html?id=${muId}`;
    const html = await (await fetch(url, { headers: { "User-Agent": "MakaronComiks/1.0" } })).text();

    const title =
      (html.match(/<span class="releasestitle tabletitle">([^<]+)<\/span>/)?.[1] ?? "Unknown").trim();

    const og = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1];

    return {
      title,
      altTitles: [],
      description: undefined,
      coverUrl: og,
      year: undefined,
      status: undefined,
      lang: undefined,
      externalId: muId,
      externalUrl: url
    };
  },
  async fetchChapters(): Promise<ChapterMeta[]> { return []; },
  async fetchPages(): Promise<PageMeta[]> { return []; }
};
