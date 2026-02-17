// src/app/api/admin/groups/[groupId]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";

const ADMIN_ALLOW = (process.env.MC_ADMIN_UIDS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ groupId: string }> }
) {
  const params = await props.params;
  const supabase = await supabaseFromCookies();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id || "";
  if (!uid || !ADMIN_ALLOW.includes(uid)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as any;
  const action = body?.action;
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const approved = action === "approve";
  const { data, error } = await supabase
    .from("scanlation_groups")
    .update({ approved })
    .eq("id", Number(params.groupId))
    .select("id, name, slug, approved")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, group: data });
}
