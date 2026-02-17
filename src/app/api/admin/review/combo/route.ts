// src/app/api/admin/review/combo/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_ALLOW = (process.env.MC_ADMIN_UIDS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Missing SUPABASE envs" }, { status: 500 });
  }

  const userClient = await supabaseFromCookies();
  const { data: auth } = await userClient.auth.getUser();
  const uid = auth?.user?.id || "";
  if (!uid || !ADMIN_ALLOW.includes(uid)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as any;
  const groupId = Number(body?.groupId);
  const uploadId = String(body?.uploadId || "");
  const doGroup = body?.approveGroup !== false;  // default true
  const doUpload = body?.approveUpload !== false; // default true
  if ((!groupId && !doGroup) || (!uploadId && !doUpload)) {
    return NextResponse.json({ error: "Missing groupId/uploadId" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1) Approve group (optional)
  if (doGroup && groupId) {
    const { error: ge } = await admin.from("scanlation_groups").update({ approved: true }).eq("id", groupId);
    if (ge) return NextResponse.json({ error: ge.message }, { status: 400 });
  }

  // 2) Approve upload -> publish (optional)
  let result: any = null;
  if (doUpload && uploadId) {
    // local source
    const { data: src } = await admin.from("sources").select("id").eq("key", "local").maybeSingle();
    if (!src) return NextResponse.json({ error: "Missing 'local' source" }, { status: 500 });

    const { data: up, error: upErr } = await admin.from("chapter_uploads").select("*").eq("id", uploadId).single();
    if (upErr || !up) return NextResponse.json({ error: upErr?.message || "Upload not found" }, { status: 404 });
    if (!["uploaded", "pending_review"].includes(up.status)) {
      return NextResponse.json({ error: `Invalid upload status: ${up.status}` }, { status: 400 });
    }

    // create chapter
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

    // link chapter_sources
    const { error: linkErr } = await admin.from("chapter_sources").insert({
      chapter_id: ch.id,
      source_id: src.id,
      external_id: `upload:${up.id}`,
      external_url: up.storage_prefix,
    });
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });

    // pages from storage
    const bucket = admin.storage.from("chapters");
    const prefix = up.storage_prefix.replace(/\/+$/, "");
    const { data: list } = await bucket.list(prefix, { limit: 2000 });
    const files = (list || [])
      .filter((o: any) => o.name)
      .map((o: any) => o.name as string)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    let pageNo = 0;
    for (const name of files) {
      pageNo++;
      const remote_url = bucket.getPublicUrl(`${prefix}/${name}`).data.publicUrl;
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

    await admin.from("chapter_uploads").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", up.id);
    result = { chapterId: ch.id, pages: files.length };
  }

  return NextResponse.json({ ok: true, published: result || null });
}
