// info: Returns latest chapter per followed series from Supabase (DB-only).
// - Reads user's follows -> recent chapters -> picks newest per series.
// - Shapes items for UpdateCard: { mangaId (slug), chapterId, title, chapter, cover, publishAt }.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { listFollowedUpdates } from "@/lib/library-db";
import { cookies } from "next/headers";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(n, hi));
}

export async function GET(req: Request) {
  try {
    const cs = await cookies();
    const lang = cs.get("mc_lang")?.value || "en";

    const url = new URL(req.url);
    // liste tekil (series başına 1 kart) olacağı için min 8, max 64 tutalım
    const limit = clamp(parseInt(url.searchParams.get("limit") || "24", 10) || 24, 8, 64);

    // Daha güvenli dedupe için limitin birkaç katını çekip JS tarafında süzeceğiz
    const rows = await listFollowedUpdates(limit * 4, lang);

    // Series bazında en yeniyi seç
    const seen = new Set<number>();
    const items: Array<{
      mangaId: string;        // slug (kanonik)
      chapterId: string;      // numeric id string
      title: string;
      chapter: string | null; // "Ch. 12" gibi
      cover: string | null;
      publishAt: string | null;
    }> = [];

    for (const r of rows) {
      if (seen.has(r.series_id)) continue;
      seen.add(r.series_id);

      const label =
        r.chapter_number !== null && r.chapter_number !== undefined
          ? `Ch. ${r.chapter_number}`
          : (r.chapter_title ?? null);

      items.push({
        mangaId: r.series_slug || String(r.series_id),
        chapterId: String(r.chapter_id),
        title: r.series_title || "Untitled",
        chapter: label,
        cover: r.cover_url || null,
        publishAt: r.published_at,
      });

      if (items.length >= limit) break;
    }

    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("/api/home/followed-updates", e);
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
