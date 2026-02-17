// src/app/api/chapters/pages/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/**
 * Return visible page counts for chapters.
 *
 * Modes:
 *  A) By id list (legacy):
 *     /api/chapters/pages?ids[]=ch1&ids[]=ch2...
 *
 *  B) By canonical parts (single):
 *     /api/chapters/pages?series=<seriesSlug>&chap=g-<shortGroup>-chapter-<label>-<lang>
 *     -> Resolves to real MD chapter id and returns { pages: { [mdChapterId]: number|null } }
 */

const UA = { accept: "application/json", "user-agent": "MakaronComiks/1.0" as const };

async function fetchOne(id: string): Promise<[string, number | null]> {
  try {
    const r = await fetch(`https://api.mangadex.org/at-home/server/${id}`, {
      headers: UA,
      cache: "no-store",
    });
    if (!r.ok) return [id, null];
    const j = (await r.json()) as { chapter?: { data?: string[] } };
    const n = j?.chapter?.data?.length ?? null;
    return [id, typeof n === "number" ? n : null];
  } catch {
    return [id, null];
  }
}

function parseCanonical(chap: string): { short: string; label: string; lang: string } | null {
  const m = chap.match(/^g-([a-z0-9]+)-chapter-([a-z0-9._-]+)-([a-z]{2})$/i);
  if (!m) return null;
  return { short: m[1].toLowerCase(), label: m[2], lang: m[3].toLowerCase() };
}

async function resolveMangaIdFromSlug(req: Request, slug: string): Promise<string> {
  const origin = new URL(req.url).origin;
  const url = new URL(`${origin}/api/series/details`);
  url.searchParams.set("slug", slug);
  const r = await fetch(url.toString(), { headers: UA, cache: "no-store" });
  if (!r.ok) throw new Error("Series details not found for slug=" + slug);
  const j: any = await r.json();
  const md =
    j?.mangaId ||
    j?.mdId ||
    j?.md_uuid ||
    j?.mangadexId ||
    j?.data?.mangaId ||
    j?.data?.mdId ||
    null;
  if (!md || typeof md !== "string") throw new Error("MangaDex id missing in details payload");
  return md;
}

type MDRel = { id: string; type: string };
type MDChapter = {
  id: string;
  type: "chapter";
  attributes: {
    chapter: string | null;
    translatedLanguage?: string | null;
    publishAt?: string | null;
    readableAt?: string | null;
    createdAt?: string | null;
  };
  relationships?: MDRel[];
};

const bestTime = (a: MDChapter["attributes"]) =>
  a.readableAt || a.publishAt || a.createdAt || null;

async function findChapterIdByCanonical(mdMangaId: string, label: string, lang: string): Promise<string | null> {
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

    const res = await fetch(url.toString(), { headers: UA, cache: "no-store" });
    if (!res.ok) break;

    const j = (await res.json()) as { data?: MDChapter[] };
    const data = j?.data ?? [];
    for (const c of data) {
      const chapLabel = c.attributes.chapter ?? "Oneshot";
      if (String(chapLabel).toLowerCase() !== String(label).toLowerCase()) continue;
      const ts = Date.parse(bestTime(c.attributes) || "") || 0;
      if (!best || ts < best.ts) best = { id: c.id, ts };
    }

    if (data.length < LIMIT) break;
    offset += LIMIT;
  }
  return best?.id || null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // A) legacy ids[]
  const ids = Array.from(new Set(searchParams.getAll("ids[]").filter(Boolean))); // dedup

  // B) canonical single
  const seriesSlug = (searchParams.get("series") || "").trim();
  const chap = (searchParams.get("chap") || "").trim();

  const out: Record<string, number | null> = {};

  // Resolve canonical first (if provided)
  if (seriesSlug && chap) {
    const parsed = parseCanonical(chap);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid chap format" }, { status: 400 });
    }
    try {
      const mdMangaId = await resolveMangaIdFromSlug(req, seriesSlug);
      const mdChapterId = await findChapterIdByCanonical(mdMangaId, parsed.label, parsed.lang);
      if (mdChapterId) {
        const [id, n] = await fetchOne(mdChapterId);
        out[id] = n;
      } else {
        // keep a placeholder for visibility
        out["__unresolved__"] = null;
      }
    } catch {
      out["__error__"] = null;
    }
  }

  if (!ids.length && !seriesSlug) {
    return NextResponse.json({ pages: out });
  }

  // 8-way parallel batches for ids[]
  for (let i = 0; i < ids.length; i += 8) {
    const chunk = ids.slice(i, i + 8);
    const res = await Promise.all(chunk.map((id) => fetchOne(id)));
    for (const [id, n] of res) out[id] = n;
  }

  return NextResponse.json({ pages: out });
}
