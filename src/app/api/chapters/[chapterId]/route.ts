// src/app/api/chapters/[chapterId]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ chapterId: string }> }
) {
  const params = await props.params;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Missing SUPABASE envs" }, { status: 500 });
  }
  const userClient = await supabaseFromCookies();
  const { data: auth } = await userClient.auth.getUser();
  const me = auth?.user;
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const chapterId = Number(params.chapterId);

  // 1) chapter -> local kaynak + upload id'yi bul
  const { data: src } = await admin.from("sources").select("id").eq("key", "local").maybeSingle();
  if (!src) return NextResponse.json({ error: "Missing 'local' source" }, { status: 500 });

  const { data: link } = await admin
    .from("chapter_sources")
    .select("external_id")
    .eq("chapter_id", chapterId)
    .eq("source_id", src.id)
    .maybeSingle();

  if (!link?.external_id?.startsWith("upload:")) {
    return NextResponse.json({ error: "Not a local/upload chapter" }, { status: 400 });
  }
  const uploadId = link.external_id.replace("upload:", "");

  // 2) upload kaydını ve grubunu getir
  const { data: up, error: ue } = await admin
    .from("chapter_uploads")
    .select("user_id, group_id, storage_prefix")
    .eq("id", uploadId)
    .single();
  if (ue || !up) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

  // 3) yetki: (a) yükleyen benim mi? veya (b) grubun manager/owner'ı mıyım?
  const { data: isManager } = await admin
    .rpc("is_group_manager_or_owner", { p_group: up.group_id, p_user: me.id });
  const allowed = up.user_id === me.id || isManager === true;
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 4) pages -> delete, sonra chapter -> delete, storage dosyalarını da temizle (opsiyonel)
  const bucket = admin.storage.from("chapters");
  // storage_prefix: groups/<gid>/series/<sid>/chapters/<uploadId>/
  const prefix = (up.storage_prefix || "").replace(/\/+$/, "");
  const { data: list } = await bucket.list(prefix, { limit: 2000 });
  if (list?.length) {
    await bucket.remove(list.map((f: any) => `${prefix}/${f.name}`));
  }

  const { error: pd } = await admin.from("pages").delete().eq("chapter_id", chapterId);
  if (pd) return NextResponse.json({ error: pd.message }, { status: 400 });

  const { error: cd } = await admin.from("chapters").delete().eq("id", chapterId);
  if (cd) return NextResponse.json({ error: cd.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
