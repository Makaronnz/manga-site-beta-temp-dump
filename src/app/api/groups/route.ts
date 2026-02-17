// src/app/api/groups/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";

export async function POST(req: NextRequest) {
  const supabase = await supabaseFromCookies();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as any;
  const name = (body?.name || "").toString().trim();
  if (!name) return NextResponse.json({ error: "Group name required" }, { status: 400 });

  // 1) grup oluştur (approved=false)
  const { data: g, error: ge } = await supabase
    .from("scanlation_groups")
    .insert({ name, approved: false })
    .select("id, name, slug, approved")
    .single();
  if (ge) return NextResponse.json({ error: ge.message }, { status: 400 });

  // 2) kendini owner ekle (RLS: gm_insert ilk üyeye izin veriyor)
  const { error: me } = await supabase
    .from("group_members")
    .insert({ group_id: g.id, user_id: auth.user.id, role: "owner" });
  if (me) return NextResponse.json({ error: me.message }, { status: 400 });

  return NextResponse.json({ ok: true, group: g });
}

export async function GET() {
  const supabase = await supabaseFromCookies();

  // Public list: approved gruplar + basic sayılar
  // (daha zengin istatistik istersen bir VIEW oluşturabiliriz)
  const { data: groups, error } = await supabase
    .from("scanlation_groups")
    .select("id, name, slug, approved")
    .eq("approved", true)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ items: groups });
}
