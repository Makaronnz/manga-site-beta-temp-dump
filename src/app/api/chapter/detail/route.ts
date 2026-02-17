// src/app/api/chapter/detail/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getChapterPages } from "@/index";
import { resolveSeries } from "@/lib/series-resolver";
import { hydrateFromMangadex } from "@/lib/series-hydrator";
import { getChapterDetails } from "@/lib/chapters-controller";

/**
 * A) /api/chapter/detail?id=<mdChapterId>[&saver=1]
 * B) /api/chapter/detail?series=<seriesSlug>&chap=g-<short>-chapter-<label>-<lang>[&saver=1]
 */

type MDRel = { id: string; type: string };
type MDChapter = {
  id: string;
  type: "chapter";
  attributes: {
    chapter: string | null;
    title: string | null;
    pages: number;
    publishAt?: string | null;
    readableAt?: string | null;
    createdAt?: string | null;
    translatedLanguage?: string | null;
  };
  relationships?: MDRel[];
};

const UA = { accept: "application/json", "user-agent": "MakaronComiks/1.0" as const };

function parseCanonical(chap: string): { short: string; label: string; lang: string } | null {
  const m = chap.match(/^g-([a-z0-9]+)-chapter-([a-z0-9._-]+)-([a-z]{2})$/i);
  if (!m) return null;
  return { short: m[1].toLowerCase(), label: m[2], lang: m[3].toLowerCase() };
}

const bestTime = (a: MDChapter["attributes"]) =>
  a.readableAt || a.publishAt || a.createdAt || null;

async function findChapterIdByCanonical(
  mdMangaId: string,
  _short: string,
  label: string,
  lang: string
): Promise<string | null> {
  // Not: MD feed’de group ismini almak için ayrıca /group fetch’i gerekir.
  // Burada önce label+lang üzerinden en makul adayı seçiyoruz.
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const saver = searchParams.get("saver") === "1";
    const seriesSlug = searchParams.get("series");
    const chap = searchParams.get("chap");

    const result = await getChapterDetails(id, seriesSlug, chap, saver);

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ pages: result.pages, resolved: result.resolved });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
