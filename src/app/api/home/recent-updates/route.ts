export const revalidate = 300; // Cache API response for 300 seconds (5 mins)

import { NextResponse } from "next/server";
import { EXCLUDED_MANGA_IDS } from "@/lib/filters";

/** Types */
type LocalizedString = Record<string, string | undefined>;
type Relationship = { id: string; type: string };
// ... types
type Chapter = {
  id: string;
  attributes: {
    chapter: string | null;
    readableAt?: string | null;
    publishAt?: string | null;
    createdAt?: string | null;
    translatedLanguage?: string;
  };
  relationships: Relationship[];
};

type MangaEntity = {
  id: string;
  attributes?: {
    title?: LocalizedString;
    tags?: { id: string }[];
  }
};
type CoverEntity = { attributes?: { fileName?: string }, relationships?: Relationship[] };

/** utils */
function pickTitle(t?: LocalizedString): string {
  if (!t) return "Untitled";
  return (
    t["en"] || t["ja-ro"] || t["ja"] || t["ko"] || t["zh-hk"] || t["zh"] ||
    (Object.values(t).find(Boolean) as string | undefined) || "Untitled"
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Route with paging */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(8, Math.min(parseInt(searchParams.get("limit") || "24", 10) || 24, 64));
    const lang = searchParams.get("lang") || "en";

    // User blocked tags (UUIDs)
    const excludedTags = searchParams.getAll("excludedTags[]");

    console.log(`[RecentUpdates] Start: page=${page}, limit=${limit}, lang=${lang}, blocked=${excludedTags.length}`);

    // MangaDex'ten bol veri alıp tekilleştiriyoruz
    // Filtreleme yapacağımız için daha fazla çekiyoruz (100)
    const mdLimit = 100;
    const mdOffset = (page - 1) * mdLimit;

    // Fetch Chapters (Tags filtresi desteklemez)
    const chapterUrl =
      "https://api.mangadex.org/chapter" +
      `?limit=${mdLimit}` +
      `&offset=${mdOffset}` +
      `&translatedLanguage[]=${encodeURIComponent(lang)}` +
      "&includes[]=manga" +
      "&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica" +
      "&order[readableAt]=desc";

    const rc = await fetch(chapterUrl, {
      headers: { accept: "application/json", "user-agent": "MakaronComiks/1.0" },
      next: { revalidate: 300 },
    });

    if (!rc.ok) {
      console.error("RecentUpdates API Error:", rc.status, rc.statusText, await rc.text());
      return NextResponse.json({ items: [], page, hasMore: false });
    }

    let jc: { data?: Chapter[]; total?: number } = { data: [], total: 0 };
    try {
      jc = await rc.json();
    } catch (parseErr) {
      // continue empty
    }
    const chapters = jc.data ?? [];

    // Collect latest chapter per manga
    const uniqueMangaIds = new Set<string>();
    const chapterMap = new Map<string, {
      mangaId: string;
      chapterId: string;
      chapter: string | null;
      publishAt: string | null;
      lang: string
    }>();

    for (const ch of chapters) {
      const relManga = ch.relationships.find((r) => r.type === "manga");
      if (!relManga) continue;
      const mId = relManga.id;
      if (uniqueMangaIds.has(mId)) continue;
      uniqueMangaIds.add(mId);

      const attr = ch.attributes;
      chapterMap.set(mId, {
        mangaId: mId,
        chapterId: ch.id,
        chapter: attr.chapter ?? null,
        publishAt: attr.readableAt || attr.publishAt || attr.createdAt || null,
        lang: attr.translatedLanguage ?? lang,
      });
      // Limit to 100 unique limit
      if (uniqueMangaIds.size >= 100) break;
    }

    if (uniqueMangaIds.size === 0) {
      return NextResponse.json({ items: [], page, hasMore: false });
    }

    // Fetch Manga Details (Title + Tags)
    const mangaIds = Array.from(uniqueMangaIds);
    const mangaDetails = new Map<string, MangaEntity>();

    for (const group of chunk(mangaIds, 100)) {
      const r = await fetch(
        `https://api.mangadex.org/manga?${group.map((id) => `ids[]=${id}`).join("&")}&limit=${group.length}`,
        { headers: { accept: "application/json", "user-agent": "MakaronComiks/1.0" }, next: { revalidate: 300 } }
      );
      if (!r.ok) continue;
      try {
        const j = await r.json() as { data?: MangaEntity[] };
        for (const m of j?.data ?? []) {
          mangaDetails.set(m.id, m);
        }
      } catch (e) {
        // ignore
      }
    }

    // Filter by Blocked Tags and Global ID Blacklist
    const blockedSet = new Set(excludedTags);
    const validMangaIds: string[] = [];

    for (const mId of mangaIds) {
      // Global Blacklist check
      if (EXCLUDED_MANGA_IDS.has(mId)) continue;

      const m = mangaDetails.get(mId);
      if (!m) continue;

      // Blocking logic (Tags)
      const tags = m.attributes?.tags || [];
      const isBlocked = tags.some(t => blockedSet.has(t.id));
      if (isBlocked) continue;

      validMangaIds.push(mId);
      // We stop only when we have enough for 2 pages or max limit to keep consistent?
      // Let's just return what we have from this batch. 
      // If we filter too many, the user will see fewer results. Pagination isn't perfect but acceptable.
    }

    // Fetch Covers for VALID items only
    const visibleIds = validMangaIds.slice(0, limit); // Respect the requested limit for rendering
    const coverMap = new Map<string, string>();

    if (visibleIds.length > 0) {
      for (const group of chunk(visibleIds, 100)) {
        const r = await fetch(
          `https://api.mangadex.org/cover?limit=100&${group.map((id) => `manga[]=${id}`).join("&")}`,
          { headers: { accept: "application/json", "user-agent": "MakaronComiks/1.0" }, next: { revalidate: 300 } }
        );
        if (r.ok) {
          const j = await r.json() as { data?: CoverEntity[] };
          for (const c of j?.data ?? []) {
            const rel = (c.relationships ?? []).find((r) => r.type === "manga");
            const mId = rel?.id, fileName = c.attributes?.fileName;
            if (mId && fileName) coverMap.set(mId, `https://uploads.mangadex.org/covers/${mId}/${fileName}.256.jpg`);
          }
        }
      }
    }

    const items = visibleIds.map(mId => {
      const ch = chapterMap.get(mId)!;
      const m = mangaDetails.get(mId);
      return {
        mangaId: mId,
        chapterId: ch.chapterId,
        chapter: ch.chapter,
        publishAt: ch.publishAt,
        title: pickTitle(m?.attributes?.title),
        cover: coverMap.get(mId) ?? null,
        lang: ch.lang,
      };
    });

    const total = jc.total ?? mdOffset + chapters.length;
    const hasMore = mdOffset + mdLimit < total;

    return NextResponse.json({ items, page, hasMore });
  } catch (e) {
    console.error("RecentUpdates API Fatal Error:", e);
    return NextResponse.json({ items: [], page: 1, hasMore: false });
  }
}
