// src/app/api/reading/route.ts
/**
 * INFO:
 * Reading progress API (canonical read/write path for autosave/Next).
 * - GET  /api/reading[?ids=csv] → merges legacy keys (slug/uuid) into **numeric series.id** keys.
 * - POST /api/reading          → forward-only by default (for Next). Use { force:true } to override.
 * This endpoint canonicalizes the series key to numeric where possible and also syncs library/follow.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";

function numLike(s?: string | null) {
  if (!s) return NaN;
  // UUID check
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s)) return NaN;

  // 1. Try "ch 7", "chapter 7", "c.7"
  const mCh = s.match(/(?:ch(?:apter)?\.?|c\.?|#)\s*([0-9.]+)/i);
  if (mCh?.[1]) {
    const n = parseFloat(mCh[1]);
    return Number.isFinite(n) ? n : NaN;
  }

  // 2. Fallback: find ALL numbers, take the LAST one (usually chapter is last, volume is first)
  // e.g. "Vol 1. 7" -> [1, 7] -> 7
  const mAll = s.match(/[0-9.]+/g);
  if (mAll && mAll.length > 0) {
    const last = mAll[mAll.length - 1];
    const n = parseFloat(last);
    return Number.isFinite(n) ? n : NaN;
  }

  return NaN;
}
import { resolveSeries } from "@/lib/series-resolver";

function isNumericKey(k?: string | null) {
  return !!k && /^[0-9]+$/.test(k);
}

async function toNumericSeriesId(
  supabase: Awaited<ReturnType<typeof supabaseFromCookies>>,
  raw: string
): Promise<number | null> {
  if (!raw) return null;
  const resolved = await resolveSeries(raw);
  return resolved?.id ?? null;
}
async function mapKeysToNumeric(supabase: Awaited<ReturnType<typeof supabaseFromCookies>>, keys: string[]) {
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
  const supabase = await supabaseFromCookies();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ progress: {} }, { headers: { "Cache-Control": "no-store" } });

  const url = new URL(req.url);
  const idsQ = url.searchParams.get("ids");
  const filterIds = (idsQ || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let q = supabase
    .from("reading_progress_ext")
    .select("series_id, chapter_id, chapter_label, updated_at")
    .eq("user_id", auth.user.id);

  if (filterIds.length) q = q.in("series_id", filterIds);

  const { data: rows } = await q;
  const rawKeys = Array.from(new Set((rows || []).map((r) => String(r.series_id))));
  const keyMap = await mapKeysToNumeric(supabase, rawKeys);

  const out: Record<string, { chapterId: string; chapter?: string | null; updatedAt?: string | null }> = {};
  for (const r of rows || []) {
    const numeric = keyMap.get(String(r.series_id));
    if (!numeric) continue;
    const key = String(numeric);
    const cur = out[key];
    if (!cur || (r.updated_at && (!cur.updatedAt || r.updated_at > cur.updatedAt))) {
      out[key] = {
        chapterId: r.chapter_id ?? "",
        chapter: r.chapter_label ?? null,
        updatedAt: r.updated_at ?? null,
      };
    }
  }

  return NextResponse.json({ progress: out }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseFromCookies();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      seriesId: string | number;
      chapterId?: string;
      chapter?: string | null;
      force?: boolean;
    };

    const rawKey = String(body.seriesId ?? "").trim();
    if (!rawKey) return NextResponse.json({ ok: false, error: "missing_series_id" }, { status: 400 });

    const canonicalNum = await toNumericSeriesId(supabase, rawKey);
    // SAFETY: If we cannot resolve to a numeric ID, we cannot write to bigint column.
    if (canonicalNum === null) {
      console.warn(`[/api/reading] Could not resolve numeric ID for series: ${rawKey}`);
      return NextResponse.json({ ok: false, error: "unresolved_series_id" }, { status: 400 });
    }
    const seriesKey = String(canonicalNum);

    // Forward-only for autosave/Next (unless force=true)
    const { data: prev } = await supabase
      .from("reading_progress_ext")
      .select("chapter_id, chapter_label")
      .eq("user_id", auth.user.id)
      .eq("series_id", seriesKey)
      .maybeSingle();

    if (!body.force && (body.chapterId || body.chapter) && prev) {
      const oldN = numLike(prev.chapter_label || prev.chapter_id);
      const newN = numLike(body.chapter || body.chapterId || "");

      // Only block if BOTH are valid numbers and new <= old
      if (Number.isFinite(oldN) && Number.isFinite(newN)) {
        if (newN <= oldN) {
          console.log(`[Reading] Ignored update. Series=${seriesKey}, Old=${oldN}, New=${newN}`);
          return NextResponse.json({ ok: true, ignored: "backward_or_same", debug: { oldN, newN } });
        }
      }
      // If one is NaN (e.g. UUID vs Number), we assume 'overwrite' is safe or necessary to repair data.
    }

    const now = new Date().toISOString();
    await supabase.from("reading_progress_ext").upsert(
      {
        user_id: auth.user.id,
        series_id: seriesKey,
        chapter_id: String(body.chapterId ?? ""),
        chapter_label: body.chapter ?? null,
        updated_at: now,
      },
      { onConflict: "user_id,series_id" }
    );

    if (canonicalNum !== null) {
      const sid = canonicalNum;
      const [ul, fw] = await Promise.all([
        supabase.from("user_library").select("series_id").eq("user_id", auth.user.id).eq("series_id", sid).maybeSingle(),
        supabase.from("follows").select("series_id").eq("user_id", auth.user.id).eq("series_id", sid).maybeSingle(),
      ]);

      if (!ul?.data && !fw?.data) {
        await Promise.allSettled([
          supabase.from("follows").upsert({ user_id: auth.user.id, series_id: sid }, { onConflict: "user_id,series_id" }),
          supabase
            .from("user_library")
            .upsert(
              { user_id: auth.user.id, series_id: sid, status: "Reading", updated_at: now },
              { onConflict: "user_id,series_id" }
            ),
        ]);
      } else {
        await supabase.from("user_library").update({ updated_at: now }).eq("user_id", auth.user.id).eq("series_id", sid);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("/api/reading POST error:", e);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
