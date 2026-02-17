// src/app/api/reading/save/route.ts
/**
 * INFO:
 * Manual save endpoint — **always honors the user’s choice**.
 * - Default `force = true` so clicking the Save button can set ANY chapter (older/newer).
 * - If `chapter` label is missing and `chapterId` is a MangaDex UUID, it fetches the label.
 * - Also ensures user_library/follows rows exist (numeric series id if resolvable).
 * - Does NOT try to canonicalize the key in reading_progress_ext (slug/uuid/numeric all OK);
 *   mapping to numeric is handled on read side (/api/reading, /api/me).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";
import { hydrateFromMangadex } from "@/lib/series-hydrator";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function numLike(s?: string | null) {
  if (!s) return NaN;
  const t = (s.match(/[\d.]+/g) || []).join("");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

async function resolveSeriesNumericId(
  supabase: Awaited<ReturnType<typeof supabaseFromCookies>>,
  raw: string
): Promise<number | null> {
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n)) return n;

  const s = await supabase.from("series").select("id").eq("slug", raw).maybeSingle();
  if (s.data?.id) return Number(s.data.id);

  const ex = await supabase.from("series_sources").select("series_id").eq("external_id", raw).maybeSingle();
  if (ex.data?.series_id) return Number(ex.data.series_id);

  return null;
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseFromCookies();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as any;
    const seriesKey = String(body.seriesId ?? "").trim();
    let chapterId: string = String(body.chapterId ?? "");
    let chapterLabel: string | null = typeof body.chapter === "string" ? body.chapter : null;

    // Default force=true so manual Save always wins
    const force: boolean = body.force !== false;

    if (!seriesKey || !chapterId) return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });

    if (!chapterLabel && UUID.test(chapterId)) {
      try {
        const r = await fetch(`https://api.mangadex.org/chapter/${chapterId}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const lbl = j?.data?.attributes?.chapter ?? null;
          if (typeof lbl === "string" && lbl.trim()) chapterLabel = lbl.trim();
        }
      } catch { }
    }

    // 1) Resolve or Hydrate Series ID (CRITICAL for FK constraints)
    let sidNum =
      (await resolveSeriesNumericId(supabase, seriesKey)) ?? (Number.isFinite(Number(seriesKey)) ? Number(seriesKey) : null);

    if (sidNum === null) {
      if (UUID.test(seriesKey)) {
        try {
          const res = await hydrateFromMangadex(seriesKey);
          sidNum = res.id;
        } catch (e) {
          console.error("Hydration failed for", seriesKey, e);
        }
      }
    }

    if (sidNum === null) {
      // If we can't get a numeric ID, we can't save to reading_progress_ext if it enforces FK to series(id)
      // Check schema: reading_progress_ext (series_id bigint references public.series(id))
      return NextResponse.json({ ok: false, error: "series_not_found" }, { status: 400 });
    }

    // Forward-only check is bypassed when force === true
    if (!force) {
      const prev = await supabase
        .from("reading_progress_ext")
        .select("chapter_id, chapter_label")
        .eq("user_id", auth.user.id)
        .eq("series_id", sidNum) // Use numeric ID
        .maybeSingle();

      if (prev.data) {
        const oldN = numLike(prev.data.chapter_label || prev.data.chapter_id);
        const newN = numLike(chapterLabel || chapterId);
        if (Number.isFinite(oldN) && Number.isFinite(newN) && !(newN > oldN)) {
          return NextResponse.json({ ok: true, ignored: "backward_or_same" });
        }
      }
    }

    const now = new Date().toISOString();

    // UPSERT with numeric ID
    const { error: upsertErr } = await supabase.from("reading_progress_ext").upsert(
      {
        user_id: auth.user.id,
        series_id: sidNum, // MUST be numeric
        chapter_id: chapterId,
        chapter_label: chapterLabel,
        updated_at: now,
      },
      { onConflict: "user_id,series_id" }
    );

    if (upsertErr) throw upsertErr;

    // Library/follow ensure logic (already has sidNum from above)
    if (sidNum !== null) {
      const [ul, fw] = await Promise.all([
        supabase
          .from("user_library")
          .select("series_id")
          .eq("user_id", auth.user.id)
          .eq("series_id", sidNum)
          .maybeSingle(),
        supabase
          .from("follows")
          .select("series_id")
          .eq("user_id", auth.user.id)
          .eq("series_id", sidNum)
          .maybeSingle(),
      ]);

      if (!ul.data && !fw.data) {
        // New entry for both
        const { error: errF } = await supabase.from("follows").upsert({ user_id: auth.user.id, series_id: sidNum }, { onConflict: "user_id,series_id" });
        if (errF) {
          console.error("Auto-follow failed during save:", errF);
        }

        const { error: errL } = await supabase.from("user_library").upsert(
          { user_id: auth.user.id, series_id: sidNum, status: "Reading", updated_at: now },
          { onConflict: "user_id,series_id" }
        );
        if (errL) throw errL;
      } else {
        const { error: errU } = await supabase
          .from("user_library")
          .update({ updated_at: now })
          .eq("user_id", auth.user.id)
          .eq("series_id", sidNum);
        if (errU) throw errU;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("/api/reading/save error:", e);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
