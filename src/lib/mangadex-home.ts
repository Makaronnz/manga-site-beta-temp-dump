import { type Rating, type MangaOrder, type Demographic, type SeriesStatus, type TagMode, type Manga } from "@/index";
// Let's rely on pure types or replicate small utils to avoid circular dep risks or bundle issues if index has side effects.
// Actually, index.ts has `getMangaList`.
// I will copy `mdFetchJSON` and `getMostRecentPopularDirect` here.

/* ─────────────────────────────────────────────────────────────
   Sağlam fetch: UA + timeout + retry (MangaDex için güvenli)
───────────────────────────────────────────────────────────── */
const UA = process.env.NEXT_PUBLIC_UA || "MakaronComiks/0.1 (+https://makaroncomiks)";

export async function mdFetchJSON<T>(
    url: string,
    { timeout = 12000, retries = 2, revalidate = 300 }: { timeout?: number; retries?: number; revalidate?: number } = {}
): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const ac = new AbortController();
        const id = setTimeout(() => ac.abort(), timeout);
        try {
            const res = await fetch(url, {
                headers: { "user-agent": UA, accept: "application/json" },
                next: { revalidate },
                signal: ac.signal,
            });
            if (!res.ok) {
                if (res.status === 429 && attempt < retries) {
                    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
                    continue;
                }
                throw new Error(`HTTP ${res.status}`);
            }
            return (await res.json()) as T;
        } catch (err) {
            lastErr = err;
            if (attempt < retries) {
                await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
                continue;
            }
        } finally {
            clearTimeout(id);
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export type Localized = Record<string, string | undefined>;
export type MDRel = { id: string; type: string; attributes?: { fileName?: string } };
export type MDManga = {
    id: string;
    attributes?: {
        title?: Localized;
        description?: Localized;
        year?: number | null;
    };
    relationships?: MDRel[];
};
type StatResponse = {
    statistics?: Record<
        string,
        { follows?: number; rating?: { average?: number | null; bayesian?: number | null } }
    >;
};

export type RailItem = {
    id: string;
    title: string;
    description: string;
    cover: string | null;
    lang?: string;
};

const pickTitleLocal = (t?: Localized) =>
    t?.en ||
    t?.["ja-ro"] ||
    t?.ja ||
    t?.ko ||
    t?.["zh-hk"] ||
    t?.zh ||
    (t ? (Object.values(t).find(Boolean) as string | undefined) : "") ||
    "Untitled";

const coverFromRel = (id: string, rels?: MDRel[] | null) => {
    const r = (rels || []).find(
        (x) => x.type === "cover_art" && x.attributes?.fileName
    );
    return r
        ? `https://uploads.mangadex.org/covers/${id}/${r.attributes!.fileName}.256.jpg`
        : null;
};

const isoDaysAgo = (days: number) =>
    new Date(Date.now() - days * 864e5).toISOString();

const chunk = <T,>(arr: T[], size = 80) =>
    Array.from(
        { length: Math.ceil(arr.length / size) },
        (_, i) => arr.slice(i * size, i * size + size)
    );

function qsArray(name: string, arr?: string[]) {
    if (!arr || !arr.length) return "";
    return arr.map((v) => `${encodeURIComponent(name)}[]=${encodeURIComponent(v)}`).join("&");
}

/** Son X günde güncellenenler içinden istatistiksel popüler liste */
export async function getMostRecentPopularDirect(
    metric: "follows" | "rating" = "follows",
    days = 30,
    limit = 24,
    ratings: Rating[] = ["safe", "suggestive"],
    excludedTags: string[] = [],
    lang = "en"
): Promise<RailItem[]> {
    let listUrl =
        `https://api.mangadex.org/manga?limit=100` +
        `&hasAvailableChapters=true` +
        `&includes[]=cover_art` +
        `&updatedAtSince=${encodeURIComponent(isoDaysAgo(days))}` +
        `&order[followedCount]=desc` +
        `&availableTranslatedLanguage[]=${encodeURIComponent(lang)}`;

    listUrl += ratings.map(r => `&contentRating[]=${r}`).join('');
    if (excludedTags.length > 0) {
        listUrl += excludedTags.map(t => `&excludedTags[]=${t}`).join('');
    }

    const listJ = await mdFetchJSON<{ data?: MDManga[] }>(listUrl, { revalidate: 3600 }).catch(() => ({
        data: [],
    }));
    const pool = listJ.data ?? [];
    if (!pool.length) return [];

    const ids = pool.map((m) => m.id);
    const statMap: Record<string, { follows: number; rating: number }> = {};
    for (const group of chunk(ids, 80)) {
        const sUrl =
            `https://api.mangadex.org/statistics/manga?` +
            group.map((id) => `manga[]=${encodeURIComponent(id)}`).join("&");
        const sj = await mdFetchJSON<StatResponse>(sUrl, { revalidate: 3600 }).catch(
            () => ({} as StatResponse)
        );
        const st = sj.statistics || {};
        for (const [id, v] of Object.entries(st)) {
            const follows = v.follows || 0;
            const rating =
                typeof v.rating?.bayesian === "number"
                    ? v.rating!.bayesian!
                    : typeof v.rating?.average === "number"
                        ? v.rating!.average!
                        : 0;
            statMap[id] = { follows, rating };
        }
    }

    const items: RailItem[] = pool.map((m) => {
        const id = m.id;
        const title = pickTitleLocal(m.attributes?.title);
        const cover = coverFromRel(id, m.relationships);
        const stat = statMap[id] || { follows: 0, rating: 0 };
        return {
            id,
            title,
            cover,
            description: `❤ ${stat.follows.toLocaleString()} • ★ ${stat.rating.toFixed(2)}`,
            lang,
        };
    });

    const getF = (s: string) => Number(s.match(/❤ ([\d,]+)/)?.[1]?.replace(/,/g, "") || 0);
    const getR = (s: string) => Number(s.match(/★ ([\d.]+)/)?.[1] || 0);

    items.sort(
        metric === "rating"
            ? (a, b) => getR(b.description) - getR(a.description) || getF(b.description) - getF(a.description)
            : (a, b) => getF(b.description) - getF(a.description) || getR(b.description) - getR(a.description)
    );

    return items.slice(0, limit);
}

// Re-export getMangaList from index for convenience if needed, but components can import directly.
// We will export a generic fetch wrapper if needed.
// ─────────────────────────────────────────────────────────────
// Cached version of getMangaList (10 mins)
// ─────────────────────────────────────────────────────────────
type MDListResponse = { data: MDManga[]; total?: number; limit?: number; offset?: number };

export async function getMangaList(params?: {
    limit?: number;
    offset?: number;
    lang?: string;
    ratings?: Rating[];
    order?: MangaOrder;
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

    // Use 10 minute cache for lists
    const data = await mdFetchJSON<MDListResponse>(url, { timeout: 10000, retries: 2, revalidate: 600 }).catch(() => ({ data: [] } as MDListResponse));

    const rawItems: Manga[] = (data.data ?? []).map((m) => ({
        id: m.id,
        title: pickTitleLocal(m.attributes?.title) || "Untitled",
        description: pickTitleLocal(m.attributes?.description), // Simplified
        cover: coverFromRel(m.id, m.relationships),
        year: m.attributes?.year ?? null,
    }));

    // Note: Local filterOutExcluded is not here, checking if index needed it.
    // Ideally this list is raw from API. `PopularRail` uses `getMostRecentPopularDirect` which has no filter.
    // HomeRail `NewestRail` implies safe list.

    const nextOffset = (data.offset ?? offset) + (data.limit ?? limit);
    // filterOutExcluded is in components/HomeRail typically for client side? No server side mostly.
    // We will return items directly.
    return { items: rawItems, nextOffset };
}
