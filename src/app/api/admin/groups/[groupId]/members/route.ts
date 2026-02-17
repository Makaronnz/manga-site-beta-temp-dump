// src/app/api/groups/[groupId]/members/route.ts
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
  const { userId, role } = body ?? {};
  if (!userId || !role || !["owner", "manager", "uploader", "viewer"].includes(role)) {
    return NextResponse.json({ error: "userId & role required" }, { status: 400 });
  }

  // RLS: yalnızca owner/manager ekleyebilir (policy'de var)
  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: Number(params.groupId), user_id: userId, role });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ groupId: string }> }
) {
  const params = await props.params;
  const supabase = await supabaseFromCookies();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // RLS: yalnızca owner/manager silebilir (policy'de var)
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", Number(params.groupId))
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
