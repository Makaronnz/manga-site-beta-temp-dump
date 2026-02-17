// src/app/api/comments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-route";

/**
 * DELETE /api/comments/:id
 * Only the owner can delete (RLS enforces ownership)
 */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await supabaseFromCookies();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idNum = Number(params.id);
  if (!Number.isFinite(idNum)) return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });

  const { error: delErr, count } = await supabase.from("comments").delete({ count: "exact" }).eq("id", idNum);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

