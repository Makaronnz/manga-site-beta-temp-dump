export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";
import { randomUUID } from "node:crypto";

/**
 * POST: Start an upload session for a whitelisted scanlation group.
 *  body: { groupId:number, seriesId:number, chapterNumber:number, title?:string, lang?:string, files:{ name, type, size }[] }
 *  resp: { uploadId, storagePrefix, uploadUrls:[{path,url}] }
 *
 * PATCH: Mark upload as finished (files PUT'ed).
 *  body: { uploadId:string, action:"markUploaded" }
 */
export async function POST(req: NextRequest) {
  const supabase = await supabaseFromCookies();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as any;
  /* Updated Body: files: { name, type, size }[] */
  const { groupId, seriesId, chapterNumber, title, lang, files } = body ?? {};

  if (!groupId || !seriesId || !chapterNumber || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "Missing fields or empty files" }, { status: 400 });
  }
  const pagesCount = files.length;
  if (pagesCount > 1000) {
    return NextResponse.json({ error: "Too many pages (max 1000)" }, { status: 400 });
  }

  const uploadId = randomUUID();
  const storagePrefix = `groups/${Number(groupId)}/series/${Number(seriesId)}/chapters/${uploadId}/`;

  // RLS: only approved group members with role (owner/manager/uploader)
  const { data: row, error } = await supabase
    .from("chapter_uploads")
    .insert({
      id: uploadId,
      group_id: Number(groupId),
      user_id: auth.user.id,
      series_id: Number(seriesId),
      chapter_number: Number(chapterNumber),
      title: title ?? null,
      lang: lang ?? null,
      pages_count: Number(pagesCount),
      storage_prefix: storagePrefix,
      status: "pending_upload",
    })
    .select("id, storage_prefix, pages_count")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Signed upload URLs (client will PUT each page file)
  const uploadUrls: { path: string; url: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const meta = files[i];
    // determine extension safely
    let ext = "jpg";
    if (meta.type === "image/png") ext = "png";
    else if (meta.type === "image/webp") ext = "webp";
    else if (meta.type === "image/jpeg") ext = "jpg";
    // fallback or trust name? Let's stick to safe allow-list or default.

    const fileName = `${String(i + 1).padStart(4, "0")}.${ext}`;
    const path = `${storagePrefix}${fileName}`;

    const { data: signed, error: signErr } = await supabase.storage
      .from("chapters")
      .createSignedUploadUrl(path);

    if (signErr || !signed) {
      return NextResponse.json({ error: signErr?.message ?? "sign error" }, { status: 500 });
    }
    uploadUrls.push({ path, url: signed.signedUrl });
  }

  return NextResponse.json({
    uploadId: row.id,
    storagePrefix: row.storage_prefix,
    uploadUrls,
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await supabaseFromCookies();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as any;
  const { uploadId, action } = body;
  if (!uploadId || action !== "markUploaded") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("chapter_uploads")
    .update({ status: "uploaded", updated_at: new Date().toISOString() })
    .eq("id", String(uploadId))
    .in("status", ["pending_upload"])
    .select("id, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, status: data.status });
}
