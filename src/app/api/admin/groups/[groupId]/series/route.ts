// src/app/api/groups/[groupId]/series/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ groupId: string }> }
) {
  const params = await props.params;
  const supabase = await supabaseFromCookies();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as any;
  const title = (body?.title || "").toString().trim();
  const lang = (body?.lang || "").toString().trim() || null;
  const year = body?.year ?? null;
  const description = body?.description ?? null;

  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  // 1) series oluştur
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const { data: s, error: se } = await supabase
    .from("series")
    .insert({ title, slug, lang, year, description })
    .select("id, title, slug")
    .single();
  if (se) return NextResponse.json({ error: se.message }, { status: 400 });

  // 2) sahipliği bağla (owner/manager RLS ile izinli)
  const { error: oe } = await supabase
    .from("group_series_ownerships")
    .insert({ group_id: Number(params.groupId), series_id: s.id });
  if (oe) return NextResponse.json({ error: oe.message }, { status: 400 });

  // 3) gruba bu seri için upload izni tanımlamak istersek (opsiyonel):
  await supabase
    .from("group_series_permissions")
    .insert({ group_id: Number(params.groupId), series_id: s.id, can_upload: true })
    .throwOnError();

  return NextResponse.json({ ok: true, series: s });
}
