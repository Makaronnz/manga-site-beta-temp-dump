// src/lib/series-controller.ts
import { NextResponse } from "next/server";
import { supabaseFromCookiesReadOnly } from "@/lib/supabase-route";

export type SeriesDetails = {
    id: string; // MD UUID or slug or "unknown"
    title: string;
    description: string;
    cover: string | null;
    year: number | null;
    status: string;
    originalLanguage: string;
    demographic: string;
    type: "Manga" | "Manhwa" | "Manhua" | "Comic";
    authors: { id: string; name: string }[];
    artists: { id: string; name: string }[];
    genres: string[];
    themes: string[];
    formats: string[];
    publishers: { slug: string; name: string; host?: string }[];
    externalLinks: { key: string; name: string; url: string }[];
};

/* ---------------- Types & helpers ---------------- */
type Localized = Record<string, string | undefined>;
type Rel = { id: string; type: string };
type Manga = {
    id: string;
    attributes?: {
        title?: Localized;
        description?: Localized;
        year?: number | null;
        status?: string | null;
        originalLanguage?: string | null;
        publicationDemographic?: string | null;
        tags?: { id: string; attributes?: { group?: string; name?: Localized } }[];
        links?: Record<string, string | undefined>;
        altTitles?: Localized[];
    };
    relationships?: Rel[];
};
type Cover = { attributes?: { fileName?: string }; relationships?: Rel[] };
type Author = { id: string; attributes?: { name?: string } };

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LINK_NAMES: Record<string, string> = {
    al: "AniList", mal: "MyAnimeList", mu: "MangaUpdates", nu: "NovelUpdates",
    ap: "Anime-Planet", kt: "Kitsu", bw: "BookWalker", ebj: "eBookJapan",
    cdj: "CDJapan", amz: "Amazon", raw: "RAW", engtl: "Official English",
};

const UA = {
    accept: "application/json",
    "user-agent": "MakaronComiks/1.0 (+https://makaroncomiks)",
} as const;

/* --------------- Helpers --------------- */
const pickTitle = (t?: Localized, alt: Localized[] = []) => {
    const chain = [t, ...alt];
    for (const obj of chain) {
        if (!obj) continue;
        for (const k of ["en", "ja-ro", "ja", "ko", "zh-hk", "zh"]) {
            const v = obj[k];
            if (v) return v;
        }
        const any = Object.values(obj).find(Boolean);
        if (any) return any as string;
    }
    return "Untitled";
};
const pickDesc = (d?: Localized) =>
    d?.en || d?.["ja-ro"] || d?.ja || d?.ko || d?.["zh-hk"] || d?.zh || "";
const inferType = (lang?: string | null) => {
    const l = (lang || "").toLowerCase();
    if (l === "ja") return "Manga";
    if (l === "ko") return "Manhwa";
    if (l === "zh" || l === "zh-hk") return "Manhua";
    return "Comic";
};

/* ---------------- DB helpers ---------------- */
async function getMdSourceId(db?: any) {
    const client = db ?? (await supabaseFromCookiesReadOnly());
    const { data } = await client.from("sources").select("id").eq("key", "mangadex").maybeSingle();
    return data?.id ? Number(data.id) : null;
}

async function findSeriesByMdId(mdId: string) {
    const db = await supabaseFromCookiesReadOnly();
    const srcId = await getMdSourceId(db);
    if (!srcId) return null;
    const map = await db.from("series_sources").select("series_id").eq("source_id", srcId).eq("external_id", mdId).maybeSingle();
    if (!map.data?.series_id) return null;
    const s = await db.from("series").select("id, slug, title, cover_url, status, original_language, year, demographic, type").eq("id", map.data.series_id).maybeSingle();
    return s.data ?? null;
}

async function findSeriesBySlug(slug: string) {
    const db = await supabaseFromCookiesReadOnly();
    const s = await db.from("series").select("id, slug, title, cover_url, status, original_language, year, demographic, type").eq("slug", slug).maybeSingle();
    return s.data ?? null;
}

const fromDb = (s: any, extraMdId?: string | null): SeriesDetails => ({
    id: extraMdId || s?.mdId || (s.id ? String(s.id) : "unknown"), // Prefer MD ID if available, else DB ID
    title: s?.title || "Untitled",
    description: s?.description || "",
    cover: s?.cover_url || null,
    year: s?.year ?? null,
    status: s?.status || "",
    originalLanguage: s?.original_language || "",
    demographic: s?.demographic || "",
    type: (s?.type as "Manga" | "Manhwa" | "Manhua" | "Comic") || "Comic",
    authors: [], artists: [], genres: [], themes: [], formats: [], publishers: [], externalLinks: [],
});

function stubFromSlugOrId(slug?: string | null, id?: string | null): SeriesDetails {
    const readable = (slug && decodeURIComponent(slug).replace(/[-_]+/g, " ").trim()) || (id && id.slice(0, 8)) || "Unknown Series";
    return {
        id: id || slug || "unknown",
        title: readable || "Unknown Series",
        description: "", cover: null, year: null, status: "", originalLanguage: "", demographic: "", type: "Comic",
        authors: [], artists: [], genres: [], themes: [], formats: [], publishers: [], externalLinks: [],
    };
}

/**
 * Core logic to fetch series details.
 * Returns { data, error, status } to be easily used by both API routes and Server Components.
 */
export async function getSeriesDetails(idParam: string, slugParam: string) {
    if (!idParam && !slugParam) {
        return { error: "missing_id_or_slug", status: 404 };
    }

    const db = await supabaseFromCookiesReadOnly();
    let mdId: string | null = null;
    let finalSlug: string | null = slugParam || null;

    // Resolve MD ID from input
    if (UUID_V4.test(idParam)) {
        mdId = idParam.toLowerCase();
    } else if (idParam) {
        // idParam might be slug
        finalSlug = idParam;
    }

    if (finalSlug && !mdId) {
        const s = await findSeriesBySlug(finalSlug);
        if (s?.id) {
            const srcId = await getMdSourceId(db);
            if (srcId) {
                const map = await db.from("series_sources").select("external_id").eq("source_id", srcId).eq("series_id", s.id).maybeSingle();
                if (map.data?.external_id && UUID_V4.test(map.data.external_id)) {
                    mdId = map.data.external_id.toLowerCase();
                }
            }
        }
    }

    // 1) Try MangaDex
    if (mdId) {
        try {
            const ctl = new AbortController();
            const t = setTimeout(() => ctl.abort(), 5000);
            const mRes = await fetch(`https://api.mangadex.org/manga/${mdId}?includes[]=cover_art&includes[]=author&includes[]=artist`, { headers: UA, cache: "no-store", signal: ctl.signal });
            clearTimeout(t);

            if (mRes.ok) {
                const j = (await mRes.json()) as { data?: Manga };
                const m = j?.data;
                if (m) {
                    // fetch cover, authors, etc. (simplified for brevity, assume similar logic)
                    // cover
                    let cover: string | null = null;
                    try {
                        const cRes = await fetch(
                            `https://api.mangadex.org/cover?limit=1&manga[]=${mdId}`,
                            { headers: UA, cache: "no-store" }
                        );
                        if (cRes.ok) {
                            const cj = (await cRes.json()) as { data?: Cover[] };
                            const c = cj?.data?.[0];
                            const file = c?.attributes?.fileName;
                            const relId = c?.relationships?.find((r) => r.type === "manga")?.id;
                            if (file && relId === mdId) {
                                cover = `https://uploads.mangadex.org/covers/${mdId}/${file}.512.jpg`;
                            }
                        }
                    } catch { }

                    // authors / artists
                    const rels = m.relationships ?? [];
                    const authorIds = rels.filter((r) => r.type === "author").map((r) => r.id);
                    const artistIds = rels.filter((r) => r.type === "artist").map((r) => r.id);
                    const personIds = Array.from(new Set([...authorIds, ...artistIds]));
                    let authors: { id: string; name: string }[] = [];
                    let artists: { id: string; name: string }[] = [];
                    if (personIds.length) {
                        try {
                            const aRes = await fetch(
                                `https://api.mangadex.org/author?${personIds
                                    .map((x) => `ids[]=${x}`)
                                    .join("&")}&limit=${personIds.length}`,
                                { headers: UA, cache: "no-store" }
                            );
                            if (aRes.ok) {
                                const aj = (await aRes.json()) as { data?: Author[] };
                                const map = new Map(
                                    (aj?.data || []).map((p) => [p.id, p.attributes?.name || ""])
                                );
                                authors = authorIds
                                    .map((x) => ({ id: x, name: map.get(x) || x }))
                                    .filter((p) => p.name);
                                artists = artistIds
                                    .map((x) => ({ id: x, name: map.get(x) || x }))
                                    .filter((p) => p.name);
                            }
                        } catch { }
                    }

                    const tagsRaw = m.attributes?.tags ?? [];
                    const tName = (t?: Localized) => t?.en || t?.["ja-ro"] || t?.ja || t?.ko || t?.["zh-hk"] || t?.zh || "";
                    const genres: string[] = []; const themes: string[] = []; const formats: string[] = [];
                    for (const t of tagsRaw) {
                        const g = (t.attributes?.group || "").toLowerCase();
                        const n = (tName(t.attributes?.name) || "").trim();
                        if (!n) continue;
                        if (g === "genre") genres.push(n); else if (g === "theme") themes.push(n); else if (g === "format") formats.push(n);
                    }

                    const linksRaw = m.attributes?.links ?? {};
                    const externalLinks = Object.entries(linksRaw).map(([key, val]) => {
                        if (!val) return null;
                        const url = /^https?:\/\//i.test(val) ? val : key === "al" ? `https://anilist.co/manga/${val}` : key === "mal" ? `https://myanimelist.net/manga/${val}` : null;
                        if (!url) return null;
                        const name = LINK_NAMES[key] ?? key.toUpperCase();
                        return { key, name, url };
                    }).filter(Boolean) as { key: string; name: string; url: string }[];

                    return {
                        data: {
                            id: mdId,
                            title: pickTitle(m.attributes?.title, m.attributes?.altTitles ?? []),
                            description: pickDesc(m.attributes?.description),
                            cover,
                            year: m.attributes?.year ?? null,
                            status: (m.attributes?.status || "") as string,
                            originalLanguage: (m.attributes?.originalLanguage || "") as string,
                            demographic: (m.attributes?.publicationDemographic || "") as string,
                            type: inferType(m.attributes?.originalLanguage),
                            authors, artists, genres, themes, formats, publishers: [], externalLinks,
                        } as SeriesDetails,
                        status: 200
                    };
                }
            }
        } catch { }
    }

    // 2) DB / Fallback
    // If we had an MD ID but MD failed, check DB
    if (mdId) {
        const s = await findSeriesByMdId(mdId);
        if (s) return { data: fromDb(s, mdId), status: 200 };
    }
    // If no MD ID but we had a slug
    if (finalSlug) {
        const s = await findSeriesBySlug(finalSlug);
        if (s) {
            // Try auto-heal if missing link logic needed (omitted for brevity, can be re-added if critical)
            // Check for link
            const srcId = await getMdSourceId(db);
            let foundMdId = null;
            if (srcId) {
                const m = await db.from("series_sources").select("external_id").eq("series_id", s.id).eq("source_id", srcId).maybeSingle();
                foundMdId = m.data?.external_id;
            }
            return { data: fromDb(s, foundMdId), status: 200 };
        }
    }

    // 3) Stub
    const stub = stubFromSlugOrId(finalSlug, mdId);
    // If strictly looking for ID that is valid UUID but nothing found => 404.
    // But if we have *something*, display stub.
    if (!mdId && !UUID_V4.test(stub.id)) {
        return { error: "not_found", status: 404 };
    }
    return { data: stub, status: 200 };
}
