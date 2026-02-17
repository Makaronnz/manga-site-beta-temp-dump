// src/app/api/me/route.ts
/**
 * info:
 * Unified /api/me (GET/POST)
 * - GET:
 *    • lite=1  → tiny payload for owner check (id, username, avatar, joinedAt)
 *    • default → full payload (profile, prefs, library with slug+mdId+continueUrl, comments)
 * - Library items now include seriesSlug and (when available) MangaDex UUID via series_sources,
 *   and build continueUrl with priority: slug → mdId → numeric id.
 * - Safe for RLS; no service role except optional old-avatar cleanup on POST.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

/* ---------- avatar helpers ---------- */
const AVATAR_BUCKET = "avatars";
const DEFAULT_AVATAR_KEY = "defaults/1.webp";

const stripSlash = (s: string) => s.replace(/\/+$/, "");
function normalizeAvatarPath(value?: string | null): string | null {
  if (!value) return null;
  let v = String(value).trim();
  if (!v) return null;
  if (
    v === "images/avatar-default.png" ||
    v === "images/avatar-default.webp" ||
    v === "avatar-default.png" ||
    v === "avatar-default.webp" ||
    v === "defaults/1.webp"
  )
    return DEFAULT_AVATAR_KEY;

  if (/^https?:\/\//i.test(v)) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? stripSlash(process.env.NEXT_PUBLIC_SUPABASE_URL)
      : "";
    const pub = base ? `${base}/storage/v1/object/public/${AVATAR_BUCKET}/` : "";
    if (pub && v.startsWith(pub)) v = v.slice(pub.length);
    else return v; // external url
  }
  v = v.replace(/^\/+/, "");
  if (v.startsWith(`storage/v1/object/public/${AVATAR_BUCKET}/`))
    v = v.slice(`storage/v1/object/public/${AVATAR_BUCKET}/`.length);
  if (v.startsWith(`${AVATAR_BUCKET}/`)) v = v.slice(`${AVATAR_BUCKET}/`.length);
  return v || null;
}
const publicAvatarUrl = (p?: string | null) => {
  const n = normalizeAvatarPath(p) ?? DEFAULT_AVATAR_KEY;
  if (/^https?:\/\//i.test(n)) return n;
  const base = stripSlash(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${n}`;
};
const isDefaultAvatar = (p?: string | null) =>
  (normalizeAvatarPath(p) ?? DEFAULT_AVATAR_KEY) === DEFAULT_AVATAR_KEY;

/* ---------- supabase helpers ---------- */
async function createClient() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, o) => jar.set({ name: n, value: v, ...o }),
        remove: (n, o) => jar.delete({ name: n, ...o }),
      },
    }
  );
}
function createAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { persistSession: false } }
  );
}
const sanitizeBaseUsername = (s?: string | null) =>
  ((s ?? "").toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 32) || "user");

async function ensureProfile(supa: ReturnType<typeof createServerClient>, user: any) {
  const { data: row, error } = await supa
    .from("user_profiles")
    .select("auth_uid,username,avatar_url,created_at,updated_at,about,links,prefs")
    .eq("auth_uid", user.id)
    .maybeSingle();
  if (row || error) return row ?? null;

  const base = sanitizeBaseUsername(
    user.user_metadata?.username ?? (user.email ? user.email.split("@")[0] : "")
  );
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? base : `${base}_${i}`;
    const { data, error: insErr } = await supa
      .from("user_profiles")
      .insert({
        auth_uid: user.id,
        username: candidate,
        avatar_url:
          normalizeAvatarPath(user.user_metadata?.avatar_url) ?? DEFAULT_AVATAR_KEY,
      })
      .select("auth_uid,username,avatar_url,created_at,updated_at,about,links,prefs")
      .maybeSingle();
    if (!insErr && data) return data;
    if (insErr && (insErr as any).code !== "23505") break;
  }
  return null;
}
async function cleanupOldAvatars(uid: string, keepRaw: string) {
  const admin = createAdmin();
  if (!admin) return;
  const keep = normalizeAvatarPath(keepRaw);
  if (!keep || /^https?:\/\//i.test(keep)) return;
  if (!keep.startsWith(`${uid}/`)) return;

  const bucket = admin.storage.from(AVATAR_BUCKET);
  const dir = uid;
  const keepName = keep.slice(dir.length + 1);
  const { data } = await bucket.list(dir, { limit: 1000 });
  const dels = (data ?? [])
    .filter((o: any) => o.name && o.name !== keepName)
    .map((o: any) => `${dir}/${o.name}`);
  if (dels.length) await bucket.remove(dels);
}

/* ---------- misc ---------- */
const numLike = (s?: string | null) => {
  if (!s) return NaN;
  const n = parseFloat((s.match(/[\d.]+/g) || []).join(""));
  return Number.isFinite(n) ? n : NaN;
};

/* ---------- extra: get MangaDex source id ---------- */
async function getMdSourceId(supa: ReturnType<typeof createServerClient>): Promise<number | null> {
  const { data } = await supa.from("sources").select("id").eq("key", "mangadex").maybeSingle();
  return data?.id ? Number(data.id) : null;
}

/* ==================== GET ==================== */
export async function GET(req: Request) {
  try {
    const supa = await createClient();
    const { data: auth } = await supa.auth.getUser();
    const user = auth?.user;

    const isLite = /^(1|true|yes)$/i.test(
      new URL(req.url).searchParams.get("lite") || ""
    );

    if (!user) {
      return NextResponse.json(
        isLite ? { user: null, mode: "lite" } : {
          user: { id: "guest", username: "Guest", email: "", avatarUrl: publicAvatarUrl(DEFAULT_AVATAR_KEY), lastActiveAt: new Date().toISOString(), joinedAt: new Date().toISOString(), about: "", links: ["", "", "", ""] },
          prefs: { theme: "system", language: "en", showMature: false, readerFit: "width" },
          stats: { totalChaptersRead: 0 }, lastRead: null, library: [], comments: [],
        },
        { status: isLite ? 401 : 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    let prof = await ensureProfile(supa, user);
    await supa.from("user_profiles").update({ updated_at: new Date().toISOString() } as any).eq("auth_uid", user.id);
    if (!prof) {
      const { data } = await supa
        .from("user_profiles")
        .select("auth_uid,username,avatar_url,created_at,updated_at,about,links,prefs")
        .eq("auth_uid", user.id)
        .maybeSingle();
      prof = data ?? null;
    }

    /* --- lite --- */
    if (isLite) {
      const avatar = publicAvatarUrl(
        normalizeAvatarPath(prof?.avatar_url) ??
        normalizeAvatarPath(user.user_metadata?.avatar_url) ??
        DEFAULT_AVATAR_KEY
      );
      return NextResponse.json(
        {
          mode: "lite",
          user: {
            id: user.id,
            username:
              prof?.username ??
              sanitizeBaseUsername(
                user.user_metadata?.username ?? (user.email ? user.email.split("@")[0] : "")
              ),
            email: user.email ?? "",
            avatarUrl: avatar,
            joinedAt: prof?.created_at ?? user.created_at ?? new Date().toISOString(),
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    /* --- full --- */
    const lastActiveAt = prof?.updated_at ?? prof?.created_at ?? new Date().toISOString();
    const preferredLang: string =
      (prof as any)?.prefs?.language || (user.user_metadata as any)?.preferredLanguage || "en";

    // library (with series.slug)
    const { data: libRows } = await supa
      .from("user_library")
      .select(
        `
        series_id,
        status,
        updated_at,
        series:series_id (
          id, slug, title, cover_url, status as series_status, updated_at
        )
      `
      )
      .eq("user_id", user.id);

    const libraryBase = (libRows ?? [])
      .map((r: any) => ({
        seriesIdStr: String(r.series_id),
        seriesIdNum: Number(r.series_id),
        seriesSlug: r.series?.slug || null,
        title: r.series?.title || "Untitled",
        coverUrl: r.series?.cover_url || null,
        seriesStatus: r.series?.series_status || "Ongoing",
        readingStatus: r.status || "Reading",
        updatedAt: r.updated_at || r.series?.updated_at || null,
      }))
      .filter((x) => x.seriesIdStr);

    // resolve MangaDex UUIDs for these series_ids (for fallback links)
    let mdMap = new Map<number, string>();
    if (libraryBase.length) {
      const mdSourceId = await getMdSourceId(supa);
      if (mdSourceId) {
        const ids = libraryBase.map((x) => x.seriesIdNum).filter((n) => Number.isFinite(n));
        const { data: mapRows } = await supa
          .from("series_sources")
          .select("series_id, external_id")
          .eq("source_id", mdSourceId)
          .in("series_id", ids);
        mdMap = new Map<number, string>(
          (mapRows ?? [])
            .filter((r: any) => typeof r.external_id === "string")
            .map((r: any) => [Number(r.series_id), String(r.external_id)])
        );
      }
    }

    // reading progress (latest per series)
    const idsNum = libraryBase.map((x) => x.seriesIdNum).filter((n) => Number.isFinite(n));
    const progBy = new Map<number, { chapterId: string; label: string | null; updatedAt: string }>();
    if (idsNum.length) {
      const { data: prog } = await supa
        .from("reading_progress_ext")
        .select("series_id, chapter_id, chapter_label, updated_at")
        .eq("user_id", user.id)
        .in("series_id", idsNum.map(String));
      for (const r of prog || []) {
        const sid = Number(r.series_id);
        const upd = (r as any).updated_at ?? new Date().toISOString();
        const prev = progBy.get(sid);
        if (!prev || upd > prev.updatedAt) {
          progBy.set(sid, {
            chapterId: String((r as any).chapter_id ?? ""),
            label: ((r as any).chapter_label as string | null) ?? null,
            updatedAt: upd,
          });
        }
      }
    }

    // chapter totals by lang (optional; harmless if table empty)
    let totals = new Map<number, number>();
    if (idsNum.length) {
      const { data: ch } = await supa
        .from("chapters")
        .select("series_id, lang")
        .in("series_id", idsNum)
        .eq("lang", preferredLang);
      const bucket: Record<number, number> = {};
      for (const row of ch || []) {
        const sid = Number((row as any).series_id);
        bucket[sid] = (bucket[sid] || 0) + 1;
      }
      totals = new Map<number, number>(Object.entries(bucket).map(([k, v]) => [Number(k), v]));
    }

    let totalChaptersRead = 0;
    const library = libraryBase.map((r) => {
      const p = progBy.get(r.seriesIdNum) || null;
      const label = p?.label ?? null;
      const realCur = Number.isFinite(numLike(label)) ? Number(numLike(label)) : Number(numLike(p?.chapterId));
      const total = totals.get(r.seriesIdNum) ?? null;

      const current =
        r.readingStatus === "Completed" && typeof total === "number"
          ? total
          : Number.isFinite(realCur)
            ? (realCur as number)
            : 0;

      if (typeof total === "number") totalChaptersRead += Math.min(current, total);
      else totalChaptersRead += current;

      const mdId = mdMap.get(r.seriesIdNum) || null;
      const continueUrl = r.seriesSlug
        ? `/series/${encodeURIComponent(r.seriesSlug)}`
        : mdId
          ? `/series/${mdId}`
          : `/series/${r.seriesIdStr}`;

      return {
        seriesId: r.seriesIdStr,
        seriesSlug: r.seriesSlug,
        mdId,
        title: r.title,
        coverUrl: r.coverUrl,
        readingStatus: r.readingStatus as
          | "Reading"
          | "Completed"
          | "On-Hold"
          | "Dropped"
          | "Plan to Read",
        seriesStatus: r.seriesStatus as "Ongoing" | "Completed" | "Cancelled" | "Hiatus",
        updatedAt: r.updatedAt,
        progress: p
          ? { current, label, updatedAt: p.updatedAt }
          : r.readingStatus === "Completed" && typeof total === "number"
            ? { current: total, label: null, updatedAt: r.updatedAt }
            : null,
        totalChapters: total,
        continueUrl,
      };
    });

    // comments
    const { data: cm } = await supa
      .from("comments")
      .select("id, series_id, chapter_id, content, created_at, series:series_id ( title )")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    const comments = (cm ?? []).map((c: any) => ({
      id: String(c.id),
      seriesId: String(c.series_id),
      seriesTitle: c.series?.title ?? "",
      chapterId: c.chapter_id ? String(c.chapter_id) : null,
      body: c.content,
      createdAt: c.created_at,
    }));

    // avatar fallback
    let effectiveAvatar = normalizeAvatarPath(prof?.avatar_url);
    const metaAva = normalizeAvatarPath(user.user_metadata?.avatar_url);
    if (isDefaultAvatar(effectiveAvatar) && !isDefaultAvatar(metaAva)) {
      effectiveAvatar = metaAva!;
      await supa.from("user_profiles").update({ avatar_url: effectiveAvatar }).eq("auth_uid", user.id);
    }
    const avatarUrl = publicAvatarUrl(effectiveAvatar);

    return NextResponse.json(
      {
        user: {
          id: user.id,
          username:
            prof?.username ??
            sanitizeBaseUsername(user.user_metadata?.username ?? (user.email ? user.email.split("@")[0] : "")),
          email: user.email ?? "",
          avatarUrl,
          lastActiveAt,
          joinedAt: prof?.created_at ?? user.created_at ?? new Date().toISOString(),
          about: prof?.about ?? "",
          links: Array.isArray(prof?.links) ? prof!.links.slice(0, 4) : ["", "", "", ""],
        },
        prefs: prof?.prefs ?? { theme: "system", language: "en", showMature: false, readerFit: "width" },
        stats: { totalChaptersRead },
        lastRead: null,
        library,
        comments,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("/api/me GET error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

/* ==================== POST ==================== */
export async function POST(req: Request) {
  try {
    const supa = await createClient();
    const { data: auth } = await supa.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as any;
    const updates: Record<string, any> = {};
    let newAvatarKey: string | null = null;

    if (typeof body.avatarUrl === "string" || typeof body.avatar_url === "string") {
      const raw = (body.avatarUrl ?? body.avatar_url) as string;
      const n = normalizeAvatarPath(raw);
      updates.avatar_url = n ?? DEFAULT_AVATAR_KEY;
      newAvatarKey = n ?? null;
    }
    if (typeof body.about === "string") updates.about = body.about.slice(0, 2000);
    if (Array.isArray(body.links)) updates.links = (body.links as string[]).slice(0, 4);
    if (body.prefs && typeof body.prefs === "object") updates.prefs = body.prefs;
    if (typeof body.username === "string" && body.username.trim()) updates.username = body.username.slice(0, 32);

    if (Object.keys(updates).length > 0) {
      const { error } = await supa.from("user_profiles").update(updates).eq("auth_uid", auth.user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (newAvatarKey && !isDefaultAvatar(newAvatarKey)) await cleanupOldAvatars(auth.user.id, newAvatarKey);

    if (typeof body.email === "string" && body.email.trim()) {
      const { error } = await supa.auth.updateUser({ email: body.email.trim() });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (typeof body.password === "string" && body.password.length >= 6) {
      const { error } = await supa.auth.updateUser({ password: body.password });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("/api/me POST error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
