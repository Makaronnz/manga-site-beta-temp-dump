// src/app/api/admin/dashboard/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_ALLOW = (process.env.MC_ADMIN_UIDS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Missing SUPABASE envs" }, { status: 500 });
  }

  // 1) User must be admin
  const userClient = await supabaseFromCookies();
  const { data: auth } = await userClient.auth.getUser();
  const uid = auth?.user?.id || "";
  if (!uid || !ADMIN_ALLOW.includes(uid)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 2) Pending groups (approved=false)
  const { data: pendingGroups, error: gErr } = await admin
    .from("scanlation_groups")
    .select("id, name, slug, approved, created_at")
    .eq("approved", false)
    .order("created_at", { ascending: false });

  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 400 });

  // 3) Pending uploads (not published)
  const { data: uploads, error: uErr } = await admin
    .from("chapter_uploads")
    .select(`
      id, group_id, user_id, series_id, chapter_number, title, lang, status, created_at, storage_prefix,
      scanlation_groups:group_id ( name, slug ),
      series:series_id ( title, slug )
    `)
    .in("status", ["pending_upload", "uploaded", "pending_review"])
    .order("created_at", { ascending: false });

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

  // 4) For each upload, list first 5 page files and return public URLs for preview
  const bucket = admin.storage.from("chapters");
  const previewPromises = (uploads ?? []).map(async (up: any) => {
    const prefix = (up.storage_prefix || "").replace(/\/+$/, "");
    const { data: objs } = await bucket.list(prefix, { limit: 5 });
    const files = (objs || [])
      .filter((o: any) => o.name)
      .map((o: any) => o.name as string)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .slice(0, 5);
    const urls = files.map((name) => bucket.getPublicUrl(`${prefix}/${name}`).data.publicUrl);
    return { uploadId: up.id, preview: urls };
  });

  const previews = await Promise.all(previewPromises);
  const previewMap = new Map(previews.map(p => [p.uploadId, p.preview]));

  const pendingUploads = (uploads || []).map((u: any) => ({
    id: u.id,
    status: u.status,
    created_at: u.created_at,
    group: { id: u.group_id, name: u.scanlation_groups?.name, slug: u.scanlation_groups?.slug },
    series: { id: u.series_id, title: u.series?.title, slug: u.series?.slug },
    chapter: { number: u.chapter_number, title: u.title, lang: u.lang },
    storage_prefix: u.storage_prefix,
    preview_pages: previewMap.get(u.id) || [],
  }));

  return NextResponse.json({ pendingGroups, pendingUploads });
}
