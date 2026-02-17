// src/app/api/admin/chapters/review/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route"; // <-- FIXED PATH/EXPORT
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

/**
 * POST: Review an uploaded chapter (approve or reject).
 *  body: { uploadId:string, action:"approve"|"reject", notes?:string }
 *  Auth: user must be in MC_ADMIN_UIDS (env), publishing uses SERVICE KEY.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_ALLOW = (process.env.MC_ADMIN_UIDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Missing SUPABASE envs" }, { status: 500 });
  }

  // verify current user is an allowed admin
  const userClient = await supabaseFromCookies();
  const { data: auth } = await userClient.auth.getUser();
  const uid = auth?.user?.id || "";
  if (!uid || !ADMIN_ALLOW.includes(uid)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as any;
  const { uploadId, action, notes } = body ?? {};
  if (!uploadId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1) fetch upload row
  const { data: up, error: upErr } = await admin
    .from("chapter_uploads")
    .select("*")
    .eq("id", String(uploadId))
    .single();

  if (upErr || !up) return NextResponse.json({ error: upErr?.message || "Upload not found" }, { status: 404 });
  if (!["uploaded", "pending_review"].includes(up.status)) {
    return NextResponse.json({ error: `Invalid status: ${up.status}` }, { status: 400 });
  }

  if (action === "reject") {
    await admin
      .from("chapter_uploads")
      .update({ status: "rejected", notes: notes || null, updated_at: new Date().toISOString() })
      .eq("id", up.id);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // 2) APPROVE → create chapter + pages and link to 'local' source
  const { data: src } = await admin.from("sources").select("id").eq("key", "local").maybeSingle();
  if (!src) return NextResponse.json({ error: "Missing 'local' source" }, { status: 500 });

  const { data: ch, error: chErr } = await admin
    .from("chapters")
    .insert({
      series_id: up.series_id,
      number: up.chapter_number,
      title: up.title ?? null,
      lang: up.lang ?? null,
      published_at: new Date().toISOString(),
      source_priority: 0,
    })
    .select()
    .single();
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 400 });

  const { error: linkErr } = await admin.from("chapter_sources").insert({
    chapter_id: ch.id,
    source_id: src.id,
    external_id: `upload:${up.id}`,
    external_url: up.storage_prefix,
  });
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });

  // 3) list files in storage and create pages
  const bucket = admin.storage.from("chapters");
  const prefix = up.storage_prefix.replace(/\/+$/, "");

  const { data: listData, error: listErr } = await bucket.list(prefix, { limit: 2000 });
  if (listErr) return NextResponse.json({ error: String(listErr) }, { status: 500 });

  const files = (listData || [])
    .filter((o: any) => o.name)
    .map((o: any) => o.name as string)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  let pageNo = 0;
  for (const name of files) {
    pageNo++;
    const fullPath = `${prefix}/${name}`;
    const { data: pub } = bucket.getPublicUrl(fullPath);
    const remote_url = pub.publicUrl; // bucket public → direct URL

    const { error: pErr } = await admin.from("pages").insert({
      chapter_id: ch.id,
      page_number: pageNo,
      remote_url,
      width: null,
      height: null,
      last_checked_at: new Date().toISOString(),
    });
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
  }

  await admin
    .from("chapter_uploads")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", up.id);

  return NextResponse.json({ ok: true, status: "published", chapterId: ch.id, pages: files.length });
}
