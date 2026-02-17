
import { resolveSeries } from "@/lib/series-resolver";
import { getChapterPages } from "@/index";
import { hydrateFromMangadex } from "@/lib/series-hydrator";

/* ---------------- types ---------------- */

type MDRel = { id: string; type: string };
type MDChapter = {
    id: string;
    type: "chapter";
    attributes: {
        chapter: string | null;
        title?: string | null;
        pages?: number;
        publishAt?: string | null;
        readableAt?: string | null;
        createdAt?: string | null;
        translatedLanguage?: string | null;
    };
    relationships?: MDRel[];
};

export type ChapterItem = {
    id: string;
    chapter: string;
    title: string;
    pages: number;
    publishAt: string | null;
    lang: string;
    groupId: string | null;
    groupShort: string;
    groupName: string | null;
    groups: string[];
    group: string;
};

export type ChapterListResponse = {
    items: ChapterItem[];
    availableLangs: string[];
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_RATINGS = ["safe", "suggestive", "erotica"];
const UA = { accept: "application/json", "user-agent": "MakaronComiks/1.0 (+https://makaroncomiks)" } as const;
const DEBUG = process.env.DEBUG_MANGADEX === "1";

const bestTime = (a: MDChapter["attributes"]) => a.readableAt || a.publishAt || a.createdAt || null;
const toNum = (v: string | null | undefined) => (v ? Number(String(v).replace(/[^0-9.]/g, "")) : Number.POSITIVE_INFINITY);
const short8 = (id?: string | null) => (id || "").replace(/-/g, "").slice(0, 8) || "unknown";
const safeJSON = async <T>(res: Response): Promise<T | null> => {
    try { return (await res.json()) as T; } catch { return null; }
};

/** Fetch with timeout and retry logic. Returns `null` on final failure. */
async function safeFetch(url: string, init?: RequestInit, timeoutMs = 8000, retries = 2): Promise<Response | null> {
    let attempt = 0;
    while (attempt <= retries) {
        try {
            const ctl = new AbortController();
            const t = setTimeout(() => ctl.abort(), timeoutMs);
            const res = await fetch(url, { ...init, signal: ctl.signal });
            clearTimeout(t);

            if (res.ok) return res;
            if (res.status === 404) {
                if (DEBUG) console.warn(`[chapters] 404 Not Found: ${url}`);
                return null; // Don't retry 404
            }
            if (res.status === 429) {
                console.warn(`[chapters] 429 Rate Limit: ${url} (retry-after: ${res.headers.get("retry-after")})`);
                return null;
            }
            if (DEBUG) console.warn(`[chapters] HTTP ${res.status} for ${url}`);

            // Retry 5xx
            if (res.status >= 500 && attempt < retries) {
                attempt++;
                await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }
            return null;
        } catch (e: any) {
            if (e?.name === 'AbortError') {
                if (DEBUG) console.warn(`[chapters] Timeout: ${url}`);
            } else {
                if (DEBUG) console.warn(`[chapters] Network err: ${url}`, e?.message);
            }
            if (attempt < retries) {
                attempt++;
                await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }
            return null;
        }
    }
    return null;
}

async function fetchGroupNames(ids: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const uniq = Array.from(new Set(ids.filter(Boolean)));
    if (!uniq.length) return out;

    // Try batch first
    const chunks: string[][] = [];
    for (let i = 0; i < uniq.length; i += 90) chunks.push(uniq.slice(i, i + 90));
    let ok = true;

    for (const chunk of chunks) {
        const u = new URL("https://api.mangadex.org/group");
        u.searchParams.set("limit", String(chunk.length));
        for (const id of chunk) u.searchParams.append("ids[]", id);
        const res = await safeFetch(u.toString(), { headers: UA }, 6000);
        if (!res) { ok = false; break; }
        const j = await safeJSON<{ data?: { id: string; attributes?: { name?: string } }[] }>(res);
        for (const g of j?.data || []) if (g?.id) out.set(g.id, g?.attributes?.name || `Group ${short8(g.id)}`);
    }
    if (ok) return out;

    // Per-id fallback (best effort)
    const missing = uniq.filter((id) => !out.has(id));
    await Promise.all(missing.map(async (id) => {
        const r = await safeFetch(`https://api.mangadex.org/group/${id}`, { headers: UA }, 5000);
        const j = r ? await safeJSON<{ data?: { id: string; attributes?: { name?: string } } }>(r) : null;
        const name = j?.data?.attributes?.name;
        if (name) out.set(id, name);
    }));
    return out;
}

function mapSingleChapter(c: MDChapter, groupName: string | null) {
    const gId = c.relationships?.find((r) => r.type === "scanlation_group")?.id || null;
    const gShort = short8(gId);
    const gName = groupName || (gId ? `Group ${gShort}` : null);
    return {
        id: c.id,
        chapter: c.attributes.chapter ?? "Oneshot",
        title: c.attributes.title ?? "",
        pages: c.attributes.pages ?? 0,
        publishAt: bestTime(c.attributes),
        lang: (c.attributes.translatedLanguage || "").toLowerCase(),
        groupId: gId,
        groupShort: gShort,
        groupName: gName,
        groups: gId ? [gId] : [],
        group: gName || (gId ? `Group ${gShort}` : "Unknown Group"),
    };
}

async function resolveMangaId(raw: string): Promise<string | null> {
    const key = (raw || "").trim();
    if (!key) return null;
    if (UUID_V4.test(key)) return key.toLowerCase();

    const resolved = await resolveSeries(key).catch(() => null);
    if (resolved?.mdId && UUID_V4.test(resolved.mdId)) return resolved.mdId.toLowerCase();

    if (UUID_V4.test(key.toLowerCase())) return key.toLowerCase();
    return null;
}

export type FetchChaptersOptions = {
    group?: string;
    lang?: string;
    limit?: number;
    byChapterId?: string;
};

export async function getSeriesChapters(
    rawIdOrSlug: string,
    options: FetchChaptersOptions = {}
): Promise<ChapterListResponse> {
    const {
        group: groupFilter = "all",
        lang: langParam = "any",
        limit = 100,
        byChapterId
    } = options;

    try {
        /* ---- fast path: by chapter id ---- */
        if (byChapterId) {
            const cleanId = byChapterId.trim();
            if (cleanId) {
                if (!UUID_V4.test(cleanId)) {
                    return { items: [], availableLangs: [] };
                }
                const u = new URL(`https://api.mangadex.org/chapter/${cleanId}`);
                u.searchParams.append("includes[]", "scanlation_group");
                const res = await safeFetch(u.toString(), { headers: UA }, 6000);
                if (!res) return { items: [], availableLangs: [] };

                const j = await safeJSON<{ data?: MDChapter }>(res);
                const ch = j?.data;
                if (!ch) return { items: [], availableLangs: [] };

                const gId = ch.relationships?.find((r) => r.type === "scanlation_group")?.id || "";
                const names = gId ? await fetchGroupNames([gId]) : new Map<string, string>();
                const item = mapSingleChapter(ch, gId ? names.get(gId) || null : null);
                return { items: [item], availableLangs: [] };
            }
        }

        /* ---- list path ---- */
        const mangaId = await resolveMangaId(rawIdOrSlug);
        if (!mangaId) {
            return { items: [], availableLangs: [] };
        }

        const validLimit = Math.min(Math.max(limit, 10), 1000);
        const MAX_PAGES = 8;
        let offset = 0;
        const all: MDChapter[] = [];

        for (let i = 0; i < MAX_PAGES; i++) {
            const url = new URL(`https://api.mangadex.org/manga/${mangaId}/feed`);
            url.searchParams.set("limit", String(Math.min(validLimit, 100)));
            url.searchParams.set("offset", String(offset));
            url.searchParams.set("order[chapter]", "asc");
            url.searchParams.set("includeFutureUpdates", "0");
            CONTENT_RATINGS.forEach((cr) => url.searchParams.append("contentRating[]", cr));
            url.searchParams.append("includes[]", "scanlation_group");

            const res = await safeFetch(url.toString(), { headers: UA }, 7000);
            if (!res) break;

            const j = await safeJSON<{ data?: MDChapter[] }>(res);
            const data = j?.data ?? [];
            all.push(...data);

            if (data.length < Math.min(validLimit, 100)) break;
            offset += Math.min(validLimit, 100);

            if (all.length >= validLimit) break;
        }

        // group names (best effort)
        const allGroupIds = Array.from(
            new Set(all.map((c) => c.relationships?.find((r) => r.type === "scanlation_group")?.id || "").filter(Boolean))
        );
        const groupNames = await fetchGroupNames(allGroupIds);

        // languages
        const availableLangs = Array.from(
            new Set(all.map((c) => (c.attributes.translatedLanguage || "").toLowerCase()).filter(Boolean))
        ).sort();

        // filters
        let filtered = all;
        if (langParam !== "any") {
            const want = new Set(langParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
            filtered = filtered.filter((c) => want.has((c.attributes.translatedLanguage || "").toLowerCase()));
        }
        if (groupFilter !== "all") {
            filtered = filtered.filter(
                (c) => (c.relationships?.find((r) => r.type === "scanlation_group")?.id || "").toLowerCase() === groupFilter.toLowerCase()
            );
        }

        // sort – chapter asc, then date asc
        filtered.sort((a, b) => {
            const d = toNum(a.attributes.chapter) - toNum(b.attributes.chapter);
            if (d !== 0) return d;
            const ta = Date.parse(bestTime(a.attributes) || "") || 0;
            const tb = Date.parse(bestTime(b.attributes) || "") || 0;
            return ta - tb;
        });

        const items = filtered.map((c) => {
            const gId = c.relationships?.find((r) => r.type === "scanlation_group")?.id || null;
            const gShort = short8(gId);
            const gName = gId ? groupNames.get(gId) || `Group ${gShort}` : null;
            return {
                id: c.id,
                chapter: c.attributes.chapter ?? "Oneshot",
                title: c.attributes.title ?? "",
                pages: c.attributes.pages ?? 0,
                publishAt: bestTime(c.attributes),
                lang: (c.attributes.translatedLanguage || "").toLowerCase(),
                groupId: gId,
                groupShort: gShort,
                groupName: gName,
                groups: gId ? [gId] : [],
                group: gName || (gId ? `Group ${gShort}` : "Unknown Group"),
            };
        });

        return { items, availableLangs };

    } catch (e) {
        if (DEBUG) console.warn("[getSeriesChapters] soft-fail:", (e as Error)?.message);
        return { items: [], availableLangs: [] };
    }
}

/* ---------------- getChapterDetails ---------------- */

function parseCanonical(chap: string): { short: string; label: string; lang: string } | null {
    const m = chap.match(/^g-([a-z0-9]+)-chapter-([a-z0-9._-]+)-([a-z]{2})$/i);
    if (!m) return null;
    return { short: m[1].toLowerCase(), label: m[2], lang: m[3].toLowerCase() };
}

async function findChapterIdByCanonical(
    mdMangaId: string,
    _short: string,
    label: string,
    lang: string
): Promise<string | null> {
    const LIMIT = 100;
    const MAX_PAGES = 10;
    let offset = 0;
    let best: { id: string; ts: number } | null = null;

    for (let i = 0; i < MAX_PAGES; i++) {
        const url = new URL(`https://api.mangadex.org/manga/${mdMangaId}/feed`);
        url.searchParams.set("limit", String(LIMIT));
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("order[chapter]", "asc");
        url.searchParams.set("includeFutureUpdates", "0");
        url.searchParams.append("contentRating[]", "safe");
        url.searchParams.append("contentRating[]", "suggestive");
        url.searchParams.append("contentRating[]", "erotica");
        url.searchParams.append("translatedLanguage[]", lang);

        const res = await safeFetch(url.toString(), { headers: UA, cache: "no-store" });
        if (!res) break;

        const j = await safeJSON<{ data?: MDChapter[] }>(res);
        for (const c of j?.data ?? []) {
            const chapLabel = c.attributes.chapter ?? "Oneshot";
            if (String(chapLabel).toLowerCase() !== String(label).toLowerCase()) continue;
            const ts = Date.parse(bestTime(c.attributes) || "") || 0;
            if (!best || ts < best.ts) best = { id: c.id, ts };
        }

        if ((j?.data?.length ?? 0) < LIMIT) break;
        offset += LIMIT;
    }

    return best?.id || null;
}

export type ChapterDetailsResponse = {
    pages?: string[];
    resolved?: { chapterId?: string };
    error?: string;
    status: number;
};

export async function getChapterDetails(
    id?: string | null,
    seriesSlug?: string | null,
    chapSlug?: string | null,
    saver = false
): Promise<ChapterDetailsResponse> {
    try {
        // Mode A: chapter id
        if (id) {
            const pages = await getChapterPages(id, saver);
            return { pages, status: 200 };
        }

        // Mode B: canonical
        const validSeries = (seriesSlug || "").trim();
        const validChap = (chapSlug || "").trim();

        if (!validSeries || !validChap) {
            return { error: "Missing parameters", status: 400 };
        }

        const parsed = parseCanonical(validChap);
        if (!parsed) return { error: "Invalid chap format", status: 400 };

        let s = await resolveSeries(validSeries);
        if (!s) {
            if (UUID_V4.test(validSeries)) {
                try {
                    s = await hydrateFromMangadex(validSeries);
                } catch {
                    return { error: "Series not found", status: 404 };
                }
            }
        }
        if (!s?.mdId) return { error: "Series has no MangaDex id", status: 404 };

        const mdChapterId = await findChapterIdByCanonical(s.mdId, parsed.short, parsed.label, parsed.lang);
        if (!mdChapterId) return { error: "Chapter not found", status: 404 };

        const pages = await getChapterPages(mdChapterId, saver);
        return { pages, resolved: { chapterId: mdChapterId }, status: 200 };
    } catch (e) {
        if (DEBUG) console.error("getChapterDetails error:", e);
        return { error: "Internal Error", status: 500 };
    }
}
