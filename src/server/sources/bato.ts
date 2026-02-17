// /src/server/sources/bato.ts
import type { SourceAdapter, SeriesMeta, ChapterMeta, PageMeta } from "./base";

const BATO_COOKIE = process.env.BATO_COOKIE || ""; // if you legally have a session

export const BatoAdapter: SourceAdapter = {
  key: "bato",

  async fetchSeriesMeta(seriesSlug: string): Promise<SeriesMeta> {
    const url = `https://bato.to/title/${seriesSlug}`;
    const html = await (await fetch(url, {
      headers: { "User-Agent": "MakaronComiks/1.0", "Cookie": BATO_COOKIE }
    })).text();

    const title = (html.match(/<h3[^>]*>([^<]+)<\/h3>/)?.[1] ?? seriesSlug).trim();
    const cover = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1];

    return {
      title,
      altTitles: [],
      description: undefined,
      coverUrl: cover,
      externalId: seriesSlug,
      externalUrl: url,
      year: undefined,
      status: undefined,
      lang: "en"
    };
  },

  async fetchChapters(seriesSlug: string): Promise<ChapterMeta[]> {
    const url = `https://bato.to/title/${seriesSlug}`;
    const html = await (await fetch(url, {
      headers: { "User-Agent": "MakaronComiks/1.0", "Cookie": BATO_COOKIE }
    })).text();

    const chaps: ChapterMeta[] = [];
    const re = /href="\/chapter\/([^"]+)"[^>]*>\s*(?:Ch\.?|Chapter)\s*([0-9.]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      chaps.push({
        number: Number(m[2]),
        externalId: m[1],
        externalUrl: `https://bato.to/chapter/${m[1]}`
      });
    }
    return chaps;
  },

  async fetchPages(chapterSlug: string): Promise<PageMeta[]> {
    const url = `https://bato.to/chapter/${chapterSlug}`;
    const html = await (await fetch(url, {
      headers: { "User-Agent": "MakaronComiks/1.0", "Cookie": BATO_COOKIE }
    })).text();

    const pages: PageMeta[] = [];
    // Prefer data attributes when present
    const re = /<img[^>]+src="([^"]+)"[^>]*?(?:data-page="(\d+)")?/g;
    let idx = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const pageNo = m[2] ? Number(m[2]) : ++idx;
      pages.push({ page: pageNo, remoteUrl: m[1] });
    }
    pages.sort((a, b) => a.page - b.page);
    return pages;
  }
};
