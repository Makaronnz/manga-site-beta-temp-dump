// src/app/api/follow/route.ts
/**
 * INFO:
 * Manage follow/library status.
 * - GET  /api/follow?seriesId=... → { followed, status } for one series
 * - GET  /api/follow              → { entries: { [seriesId]: { seriesId, status, title, coverUrl, updatedAt } } }
 * - POST /api/follow              → { ok, status } (status="Unfollow" deletes rows)
 * NOTE: Setting status to "Completed" does NOT touch reading_progress_ext.
 *       Library UI will show progress=total for Completed via /api/me logic (later step).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";
import { hydrateFromMangadex } from "@/lib/series-hydrator";

type FollowStatus = "Unfollow" | "Reading" | "Completed" | "On-Hold" | "Dropped" | "Plan to Read";

import { resolveSeries } from "@/lib/series-resolver";

async function resolveSeriesNumericId(
  supabase: Awaited<ReturnType<typeof supabaseFromCookies>>,
  raw: string
): Promise<number | null> {
  if (!raw) return null;
  const resolved = await resolveSeries(raw);
  return resolved?.id ?? null;
}

export async function GET(req: Request) {
  const supabase = await supabaseFromCookies();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ entries: {}, followed: false, status: "Unfollow" });

  const url = new URL(req.url);
  const seriesQ = (url.searchParams.get("seriesId") || "").trim();

  if (seriesQ) {
    const sidNum =
      (await resolveSeriesNumericId(supabase, seriesQ)) ?? (Number.isFinite(Number(seriesQ)) ? Number(seriesQ) : null);
    if (sidNum === null) return NextResponse.json({ followed: false, status: "Unfollow" });

    const { data } = await supabase
      .from("user_library")
      .select("status")
      .eq("user_id", auth.user.id)
      .eq("series_id", sidNum)
      .maybeSingle();

    const followed = !!data;
    const status: FollowStatus = (data?.status as FollowStatus) || (followed ? "Reading" : "Unfollow");
    return NextResponse.json({ followed, status });
  }

  // List all follows logic...
  // Note: We use 'user_library' logic here, but some old code might rely on 'follows'. 
  // We sync both tables in POST, but read from user_library here for status.
  const { data } = await supabase
    .from("user_library")
    .select("series_id, status, updated_at, series:series_id ( title, cover_url )")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false })
    .limit(1000);

  const entries: Record<
    string,
    { seriesId: string; status: FollowStatus; title?: string | null; coverUrl?: string | null; updatedAt: string }
  > = {};
  for (const r of data || []) {
    entries[String(r.series_id)] = {
      seriesId: String(r.series_id),
      status: (r.status as FollowStatus) ?? "Reading",
      title: Array.isArray(r.series) ? r.series[0]?.title : (r.series as any)?.title ?? null,
      coverUrl: Array.isArray(r.series) ? r.series[0]?.cover_url : (r.series as any)?.cover_url ?? null,
      updatedAt: r.updated_at || new Date().toISOString(),
    };
  }
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseFromCookies();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({})) as any;
    const seriesKey = String(body.seriesId ?? "").trim();
    const status: FollowStatus = (body.status as FollowStatus) || "Reading";
    const title = typeof body.title === "string" ? body.title : undefined;
    const coverUrl = typeof body.coverUrl === "string" ? body.coverUrl : undefined;

    if (!seriesKey) return NextResponse.json({ error: "missing_series_id" }, { status: 400 });

    let sidNum =
      (await resolveSeriesNumericId(supabase, seriesKey)) ?? (Number.isFinite(Number(seriesKey)) ? Number(seriesKey) : null);

    // Auto-hydration: If not found locally, try to hydrate from MangaDex (if it looks like a UUID)
    if (sidNum === null) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seriesKey)) {
        try {
          const res = await hydrateFromMangadex(seriesKey);
          sidNum = res.id;
        } catch (e) {
          console.error("Hydration failed for", seriesKey, e);
        }
      }
    }

    if (sidNum === null) return NextResponse.json({ error: "series_not_found" }, { status: 400 });

    if (status === "Unfollow") {
      const { error: e1 } = await supabase.from("user_library").delete().eq("user_id", auth.user.id).eq("series_id", sidNum);
      const { error: e2 } = await supabase.from("follows").delete().eq("user_id", auth.user.id).eq("series_id", sidNum);

      if (e1) throw e1;
      if (e2) throw e2;

      return NextResponse.json({ ok: true, status: "Unfollow" });
    }

    const now = new Date().toISOString();

    // Explicitly await each and check errors
    const { error: e3 } = await supabase.from("follows").upsert(
      { user_id: auth.user.id, series_id: sidNum },
      { onConflict: "user_id,series_id" }
    );
    if (e3) {
      console.error("Follow upsert failed:", e3);
      throw e3;
    }

    const { error: e4 } = await supabase.from("user_library").upsert(
      { user_id: auth.user.id, series_id: sidNum, status, updated_at: now },
      { onConflict: "user_id,series_id" }
    );
    if (e4) {
      console.error("Library upsert failed:", e4);
      throw e4;
    }

    return NextResponse.json({ ok: true, status, title, coverUrl });
  } catch (e) {
    console.error("/api/follow POST error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
