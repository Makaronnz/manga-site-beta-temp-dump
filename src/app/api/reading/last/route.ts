// src/app/api/reading/last/route.ts
/**
 * INFO:
 * Return the user's last-read for a series, accepting slug/uuid/numeric keys.
 * It checks both the provided key and its numeric mapping, and returns the newest record.
 * Response: { chapterId, chapter, updatedAt } (nulls if none)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";

function isNumericKey(k?: string | null) {
  return !!k && /^[0-9]+$/.test(k);
}
async function toNumericSeriesId(
  supabase: Awaited<ReturnType<typeof supabaseFromCookies>>,
  raw: string
): Promise<number | null> {
  if (!raw) return null;
  if (isNumericKey(raw)) return Number(raw);
  const s = await supabase.from("series").select("id").eq("slug", raw).maybeSingle();
  if (s.data?.id) return Number(s.data.id);
  const ex = await supabase.from("series_sources").select("series_id").eq("external_id", raw).maybeSingle();
  if (ex.data?.series_id) return Number(ex.data.series_id);
  return null;
}

export async function GET(req: Request) {
  const supabase = await supabaseFromCookies();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user)
    return NextResponse.json({ chapterId: null, chapter: null, updatedAt: null }, { headers: { "Cache-Control": "no-store" } });

  const url = new URL(req.url);
  const raw = (url.searchParams.get("seriesId") || "").trim();
  if (!raw)
    return NextResponse.json({ chapterId: null, chapter: null, updatedAt: null }, { headers: { "Cache-Control": "no-store" } });

  const numeric = await toNumericSeriesId(supabase, raw);

  // FIX: database 'series_id' is bigint, so we CANNOT pass non-numeric strings like slugs/UUIDs.
  // We only query if we actually resolved a numeric ID.
  if (!numeric) {
    return NextResponse.json({ chapterId: null, chapter: null, updatedAt: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data: rows } = await supabase
    .from("reading_progress_ext")
    .select("chapter_id, chapter_label, updated_at")
    .eq("user_id", auth.user.id)
    .eq("series_id", numeric); // use .eq with the single valid ID

  let best: { chapter_id?: string | null; chapter_label?: string | null; updated_at?: string | null } | null = null;
  for (const r of rows || []) {
    if (!best || (r.updated_at && (!best.updated_at || r.updated_at > best.updated_at))) best = r;
  }

  return NextResponse.json(
    {
      chapterId: best?.chapter_id ?? null,
      chapter: best?.chapter_label ?? null,
      updatedAt: best?.updated_at ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
