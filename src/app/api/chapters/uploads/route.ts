// src/app/api/chapters/upload/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";
import { randomUUID } from "node:crypto";

/**
 * POST: upload oturumu başlat, imzalı URL'leri dön
 * body: { groupId: number, seriesId: number, chapterNumber: number, title?: string, lang?: string, pagesCount: number }
 *
 * PATCH: yüklemeyi tamamlandı işaretle
 * body: { uploadId: string, action: "markUploaded" }
 */
export async function POST(req: NextRequest) {
  const supabase = await supabaseFromCookies();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as any;
  const { groupId, seriesId, chapterNumber, title, lang, pagesCount } = body ?? {};
  if (!groupId || !seriesId || !chapterNumber || !pagesCount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (pagesCount < 1 || pagesCount > 1000) {
    return NextResponse.json({ error: "pagesCount out of range" }, { status: 400 });
  }

  const uploadId = randomUUID();
  const storagePrefix = `groups/${groupId}/series/${seriesId}/chapters/${uploadId}/`;

  // 1) Kuyruk kaydı (RLS: sadece onaylı grup uploader'ı geçer)
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

  // 2) İmzalı upload URL'leri
  const uploadUrls: { path: string; url: string }[] = [];
  for (let i = 1; i <= Number(pagesCount); i++) {
    const fileName = `${String(i).padStart(4, "0")}.jpg`; // istersen .webp
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
  const { uploadId, action } = body ?? {};
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
