// src/index.ts

// ─────────────────────────────────────────────────────────────
// Tipler (MangaDex ham veri)
// ─────────────────────────────────────────────────────────────
type MDRelationship = {
  id: string;
  type: string;
  attributes?: { fileName?: string;[k: string]: unknown };
};

type MDManga = {
  id: string;
  attributes: {
    title: Record<string, string | undefined>;
    description: Record<string, string | undefined>;
    year?: number | null;
  };
  relationships?: MDRelationship[];
};

type MDListResponse = { data: MDManga[]; total?: number; limit?: number; offset?: number };
type MDDetailResponse = { data: MDManga };
type MDChapterSummary = { id: string; attributes: { title: string | null; chapter: string | null } };
type MDChapterListResponse = { data: MDChapterSummary[]; limit?: number; offset?: number };
type MDAtHomeResponse = { baseUrl: string; chapter?: { hash: string; data: string[]; dataSaver?: string[] } };

// ─────────────────────────────────────────────────────────────
// Normalize tipler (UI)
// ─────────────────────────────────────────────────────────────
export type Manga = { id: string; title: string; description: string; cover: string | null; year?: number | null };
export type Chapter = { id: string; title: string; chapter: string | null };

export type MangaOrder = "relevance" | "followedCount" | "createdAt" | "latestUploadedChapter";
export type Demographic = "shounen" | "shoujo" | "seinen" | "josei" | "none";
export type SeriesStatus = "ongoing" | "completed" | "hiatus" | "cancelled";
export type Rating = "safe" | "suggestive" | "erotica" | "pornographic";
export type TagMode = "AND" | "OR";

// ─────────────────────────────────────────────────────────────
// Yardımcılar
// ─────────────────────────────────────────────────────────────
import { filterOutExcluded } from "@/lib/filters";

const UA = process.env.NEXT_PUBLIC_UA || "MakaronComiks/0.1";
const DEFAULT_HEADERS: HeadersInit =
  typeof window === "undefined" ? { "User-Agent": UA } : {}; // tarayıcıda UA set etmeyelim

function pickLang<T extends Record<string, string | undefined>>(multi: T | undefined, lang: string): string {
  if (!multi) return "";
  return multi[lang] ?? (Object.values(multi).find(Boolean) ?? "")!;
}

function coverFromRelationships(m: MDManga): string | null {
  const rel = m.relationships?.find((r) => r.type === "cover_art");
  const file = rel?.attributes?.fileName;
  return file ? `https://uploads.mangadex.org/covers/${m.id}/${file}` : null;
}

function qsArray(name: string, arr?: string[]) {
  if (!arr || !arr.length) return "";
  return arr.map((v) => `${encodeURIComponent(name)}[]=${encodeURIComponent(v)}`).join("&");
}

/** Güvenli fetch: timeout + retry (+429 Retry-After saygı) */
async function fetchJSON<T>(
  url: string,
  {
    timeout = 10000,
    retries = 2,
  }: { timeout?: number; retries?: number } = {}
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const id = setTimeout(() => ac.abort(), timeout);
    try {
      const res = await fetch(url, { headers: DEFAULT_HEADERS, cache: "no-store", signal: ac.signal });
      if (!res.ok) {
        // oran sınırlama ise bekle ve yeniden dene
        if (res.status === 429 && attempt < retries) {
          const ra = Number(res.headers.get("Retry-After") || 0);
          await new Promise((r) => setTimeout(r, (ra ? ra * 1000 : 600) * (attempt + 1)));
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err: any) {
      lastErr = err;
      // AbortError veya ağ hatası: tekrar deneyelim
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
    } finally {
      clearTimeout(id);
    }
  }
  throw new Error(`fetch failed: ${String((lastErr as any)?.message || lastErr)}`);
}

// ─────────────────────────────────────────────────────────────
// Dışa açık fonksiyonlar
// ─────────────────────────────────────────────────────────────
export async function getMangaList(params?: {
  limit?: number;
  offset?: number;
  lang?: string; // availableTranslatedLanguage
  ratings?: Rating[];
  order?: MangaOrder;

  // gelişmiş filtreler
  title?: string;
  publicationDemographic?: Demographic[];
  status?: SeriesStatus[];
  includedTags?: string[];
  excludedTags?: string[];
  includedTagsMode?: TagMode;
  excludedTagsMode?: TagMode;
  originalLanguage?: string[];
  excludedOriginalLanguage?: string[];
  createdAtSince?: string;
  year?: number;
  ignoreLangFilter?: boolean;
}) {
  const limit = Math.min(Math.max(1, params?.limit ?? 30), 100);
  const offset = Math.max(0, params?.offset ?? 0);
  const lang = params?.lang ?? "en";
  const ratings = params?.ratings ?? ["safe", "suggestive"];
  const order: MangaOrder = params?.order ?? "relevance";

  const parts: string[] = [
    `limit=${limit}`,
    `offset=${offset}`,
    `includes[]=cover_art`,
    `order[${encodeURIComponent(order)}]=desc`,
    ratings.map((r) => `contentRating[]=${encodeURIComponent(r)}`).join("&"),
  ];

  if (!params?.ignoreLangFilter) {
    parts.push(`availableTranslatedLanguage[]=${encodeURIComponent(lang)}`);
  }

  if (params?.title) parts.push(`title=${encodeURIComponent(params.title)}`);
  if (params?.publicationDemographic?.length)
    parts.push(qsArray("publicationDemographic", params.publicationDemographic));
  if (params?.status?.length) parts.push(qsArray("status", params.status));
  if (params?.includedTags?.length) parts.push(qsArray("includedTags", params.includedTags));
  if (params?.excludedTags?.length) parts.push(qsArray("excludedTags", params.excludedTags));
  if (params?.includedTagsMode) parts.push(`includedTagsMode=${params.includedTagsMode}`);
  if (params?.excludedTagsMode) parts.push(`excludedTagsMode=${params.excludedTagsMode}`);
  if (params?.originalLanguage?.length) parts.push(qsArray("originalLanguage", params.originalLanguage));
  if (params?.excludedOriginalLanguage?.length)
    parts.push(qsArray("excludedOriginalLanguage", params.excludedOriginalLanguage));
  if (params?.createdAtSince) parts.push(`createdAtSince=${encodeURIComponent(params.createdAtSince)}`);
  if (Number.isFinite(params?.year)) parts.push(`year=${params?.year}`);

  const url = `https://api.mangadex.org/manga?${parts.filter(Boolean).join("&")}`;

  const data = await fetchJSON<MDListResponse>(url, { timeout: 10000, retries: 2 });

  const rawItems: Manga[] = (data.data ?? []).map((m) => ({
    id: m.id,
    title: pickLang(m.attributes?.title, lang) || "Untitled",
    description: pickLang(m.attributes?.description, lang),
    cover: coverFromRelationships(m),
    year: m.attributes?.year ?? null,
  }));

  // 🔹 Global kara liste
  const items = filterOutExcluded(rawItems);

  const nextOffset = (data.offset ?? offset) + (data.limit ?? limit);
  return { items, nextOffset };
}

export async function getMangaDetail(id: string, lang = "en"): Promise<Manga> {
  const url = `https://api.mangadex.org/manga/${id}?includes[]=cover_art`;
  const data = await fetchJSON<MDDetailResponse>(url, { timeout: 10000, retries: 2 });
  const m = data.data;
  return {
    id: m.id,
    title: pickLang(m.attributes?.title, lang) || "Untitled",
    description: pickLang(m.attributes?.description, lang),
    cover: coverFromRelationships(m),
    year: m.attributes?.year ?? null,
  };
}

export async function getChapters(mangaId: string, { limit = 30, offset = 0, lang = "en" } = {}) {
  const parts: string[] = [
    `limit=${limit}`,
    `offset=${offset}`,
    `translatedLanguage[]=${encodeURIComponent(lang)}`,
    `order[chapter]=asc`,
    `includes[]=scanlation_group`,
  ];
  const url = `https://api.mangadex.org/manga/${encodeURIComponent(mangaId)}/feed?${parts.join("&")}`;

  const data = await fetchJSON<MDChapterListResponse>(url, { timeout: 12000, retries: 2 });

  const chapters: Chapter[] = (data.data ?? []).map((c) => ({
    id: c.id,
    title: c.attributes.title ?? (c.attributes.chapter ? `Chapter ${c.attributes.chapter}` : "Chapter"),
    chapter: c.attributes.chapter,
  }));

  const nextOffset = (data.offset ?? offset) + (data.limit ?? limit);
  return { chapters, nextOffset };
}

export async function getChapterPages(chapterId: string, saver = true): Promise<string[]> {
  const url = `https://api.mangadex.org/at-home/server/${encodeURIComponent(chapterId)}`;
  const data = await fetchJSON<MDAtHomeResponse>(url, { timeout: 12000, retries: 2 });
  if (!data.baseUrl || !data.chapter) return [];
  const files = saver && data.chapter.dataSaver?.length ? data.chapter.dataSaver : data.chapter.data;
  return files.map((f) => `${data.baseUrl}/data/${data.chapter!.hash}/${f}`);
}
