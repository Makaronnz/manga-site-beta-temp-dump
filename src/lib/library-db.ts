// src/lib/library-db.ts
/**
 * info: Library DB helpers for MakaronComiks (follows & reading progress).
 * - Favorites feature is disabled: getMyFavorites/setMyFavorites now return no data (safe stubs).
 * - Exposes:
 *    • listFollows, setFollow
 *    • saveReadingProgress
 *    • listFollowedUpdates
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseFromCookies, supabaseFromCookiesReadOnly } from "@/lib/supabase-route";

/** Small helpers */
type Uid = string;

export type FollowedSeries = {
  id: number;
  slug: string;
  title: string;
  cover_url: string | null;
  updated_at: string | null;
};

export type FollowToggleInput = {
  seriesId: number;      // series.id (bigint)
  follow: boolean;       // true=follow, false=unfollow
};

export type SaveReadingProgressInput = {
  /** If you have series numeric id -> pass this. Stored as text inside reading_progress_ext. */
  seriesId?: number;
  /** Or pass a stable series key (slug / external id). Will be stored as text. */
  seriesKey?: string;
  chapterId?: string | number;
  chapterLabel?: string; // e.g. "Ch. 6"
};

/** Read-only client for GET handlers */
async function ro(): Promise<SupabaseClient> {
  return supabaseFromCookiesReadOnly();
}

/** R/W client for POST/PUT/DELETE handlers */
async function rw(): Promise<SupabaseClient> {
  return supabaseFromCookies();
}

async function getUserId(db: SupabaseClient): Promise<Uid | null> {
  const { data: { user } } = await db.auth.getUser();
  return user?.id ?? null;
}

/** List followed series (DB only). Returns empty if not logged in. */
export async function listFollows(): Promise<FollowedSeries[]> {
  const db = await ro();
  const uid = await getUserId(db);
  if (!uid) return [];

  // join series table for proper title/cover (no cookie fallback)
  const { data, error } = await db
    .from("follows")
    .select(`
      series_id,
      series:series_id (
        id,
        slug,
        title,
        cover_url,
        updated_at
      )
    `)
    .eq("user_id", uid);

  if (error) throw error;

  return (data ?? [])
    .map((row: any) => row.series)
    .filter(Boolean) as FollowedSeries[];
}

/** Follow or unfollow a series (by numeric series.id). */
export async function setFollow(input: FollowToggleInput): Promise<{ ok: true }> {
  const db = await rw();
  const uid = await getUserId(db);
  if (!uid) return { ok: true }; // silently no-op if not logged

  if (input.follow) {
    const { error } = await db
      .from("follows")
      .upsert({ user_id: uid, series_id: input.seriesId });
    if (error) throw error;
  } else {
    const { error } = await db
      .from("follows")
      .delete()
      .match({ user_id: uid, series_id: input.seriesId });
    if (error) throw error;
  }

  return { ok: true };
}

/** Save reading progress (stored in reading_progress_ext with TEXT keys). */
export async function saveReadingProgress(input: SaveReadingProgressInput): Promise<{ ok: true }> {
  const db = await rw();
  const uid = await getUserId(db);
  if (!uid) return { ok: true };

  const seriesText =
    typeof input.seriesId === "number"
      ? String(input.seriesId)
      : (input.seriesKey ?? "");

  const chapterText =
    input.chapterId === undefined ? "" : String(input.chapterId);

  if (!seriesText) return { ok: true };

  const payload = {
    user_id: uid,
    series_id: seriesText,
    chapter_id: chapterText,
    chapter_label: input.chapterLabel ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from("reading_progress_ext")
    .upsert(payload, { onConflict: "user_id,series_id" });

  if (error) throw error;
  return { ok: true };
}

export type FollowedUpdateItem = {
  series_id: number;
  series_slug: string;
  series_title: string;
  cover_url: string | null;
  chapter_id: number;
  chapter_number: string | number | null;
  chapter_title: string | null;
  lang: string | null;
  published_at: string | null;
};

/**
 * Recent updates among followed series.
 * Strategy: WHERE series_id IN (SELECT series_id FROM follows WHERE user_id=...)
 * ORDER BY published_at DESC NULLS LAST, chapters.updated_at DESC
 */
export async function listFollowedUpdates(limit = 50, lang?: string): Promise<FollowedUpdateItem[]> {
  const db = await ro();
  const uid = await getUserId(db);
  if (!uid) return [];

  // Get user follows
  const { data: flw, error: e1 } = await db
    .from("follows")
    .select("series_id")
    .eq("user_id", uid);

  if (e1) throw e1;
  const seriesIds = (flw ?? []).map((x: any) => x.series_id);
  if (seriesIds.length === 0) return [];

  // Fetch recent chapters for those series
  // Fetch recent chapters for those series
  let query = db
    .from("chapters")
    .select(`
      id,
      series_id,
      number,
      title,
      lang,
      published_at,
      series:series_id (
        slug,
        title,
        cover_url
      )
    `)
    .in("series_id", seriesIds);

  if (lang) {
    query = query.eq("lang", lang);
  }

  const { data, error } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    series_id: row.series_id,
    series_slug: row.series?.slug ?? "",
    series_title: row.series?.title ?? "",
    cover_url: row.series?.cover_url ?? null,
    chapter_id: row.id,
    chapter_number: row.number,
    chapter_title: row.title,
    lang: row.lang,
    published_at: row.published_at,
  }));
}

/* ───────────── Favorites disabled – safe stubs to avoid build breaks ───────────── */

export type FavoriteSeriesRow = never; // deprecated – no favorites

/** @deprecated Favorites are disabled; always returns an empty list. */
export async function getMyFavorites(): Promise<FavoriteSeriesRow[]> {
  return [];
}

/** @deprecated Favorites are disabled; no-op that always succeeds. */
export async function setMyFavorites(_ids: number[]): Promise<{ ok: true }> {
  return { ok: true };
}
