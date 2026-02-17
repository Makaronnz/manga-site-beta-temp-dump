// src/app/api/home/reading-history/route.ts
/**
 * info:
 * Reading History API.
 * - reading_progress_ext'teki kayıtları kullanıcı için çeker,
 *   mixed series key'leri (slug/uuid/numeric) -> numeric series.id'ye eşler.
 * - Her seri için EN GÜNCEL kaydı alıp FE'nin Item tipine (mangaId=slug) dönüştürür.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";

type Item = {
  mangaId: string;          // series.slug
  chapterId: string;
  title: string;
  chapter: string | null;   // chapter_label
  cover: string | null;     // series.cover_url
  publishAt: string | null; // reading_progress_ext.updated_at
  lang?: string;
};

function isNumericKey(k?: string | null) {
  return !!k && /^[0-9]+$/.test(k);
}

async function mapKeysToNumeric(
  supabase: Awaited<ReturnType<typeof supabaseFromCookies>>,
  keys: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const pend: string[] = [];
  for (const k of keys) {
    if (isNumericKey(k)) out.set(k, Number(k));
    else pend.push(k);
  }
  if (pend.length === 0) return out;

  const { data: bySlug } = await supabase.from("series").select("id, slug").in("slug", pend);
  for (const r of bySlug || []) out.set(String(r.slug), Number(r.id));

  const still = pend.filter((k) => !out.has(k));
  if (still.length) {
    const { data: byExt } = await supabase.from("series_sources").select("external_id, series_id").in("external_id", still);
    for (const r of byExt || []) out.set(String(r.external_id), Number(r.series_id));
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseFromCookies();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const url = new URL(req.url);
    const limit = Math.max(8, Math.min(parseInt(url.searchParams.get("limit") || "24", 10) || 24, 64));

    // 1) Kullanıcının okuma kayıtlarını çek
    const { data: rows, error: e1 } = await supabase
      .from("reading_progress_ext")
      .select("series_id, chapter_id, chapter_label, updated_at")
      .eq("user_id", auth.user.id);

    if (e1) throw e1;

    // 2) series_id (TEXT) -> numeric id
    const rawKeys = Array.from(new Set((rows ?? []).map((r) => String(r.series_id))));
    const keyMap = await mapKeysToNumeric(supabase, rawKeys);

    // 3) Her seri için en güncel kaydı seç
    const latestBySeries = new Map<number, { chapter_id: string; chapter_label: string | null; updated_at: string | null }>();
    for (const r of rows ?? []) {
      const numeric = keyMap.get(String(r.series_id));
      if (!numeric) continue;
      const prev = latestBySeries.get(numeric);
      if (!prev || (r.updated_at && (!prev.updated_at || r.updated_at > prev.updated_at))) {
        latestBySeries.set(numeric, {
          chapter_id: String(r.chapter_id ?? ""),
          chapter_label: r.chapter_label ?? null,
          updated_at: r.updated_at ?? null,
        });
      }
    }

    if (latestBySeries.size === 0) {
      return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    // 4) Series bilgilerini topla
    const seriesIds = Array.from(latestBySeries.keys());
    const chapterIds = Array.from(latestBySeries.values()).map(r => r.chapter_id);

    const [serRes, chRes] = await Promise.all([
      supabase.from("series").select("id, slug, title, cover_url").in("id", seriesIds),
      supabase.from("chapters").select("id, lang").in("id", chapterIds)
    ]);

    const { data: ser, error: e2 } = serRes;
    if (e2) throw e2;

    const sMap = new Map<number, { slug: string; title: string; cover_url: string | null }>();
    for (const s of ser ?? []) {
      sMap.set(Number(s.id), { slug: String(s.slug), title: String(s.title ?? "Untitled"), cover_url: (s as any).cover_url ?? null });
    }

    const langMap = new Map<string, string>();
    for (const c of chRes.data ?? []) {
      langMap.set(String(c.id), c.lang);
    }

    // 5) Çıkışı güncelliğe göre sırala ve limite göre kes
    const items: Item[] = Array.from(latestBySeries.entries())
      .map(([sid, rec]) => {
        const s = sMap.get(sid);
        return {
          mangaId: s?.slug ?? String(sid),
          chapterId: rec.chapter_id,
          title: s?.title ?? "Untitled",
          chapter: rec.chapter_label,
          cover: s?.cover_url ?? null,
          publishAt: rec.updated_at ?? null,
          lang: langMap.get(rec.chapter_id),
        };
      })
      .sort((a, b) => (b.publishAt || "").localeCompare(a.publishAt || ""))
      .slice(0, limit);

    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("/api/home/reading-history error:", err);
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
