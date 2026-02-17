/** info: API – /api/profile (self/public)
 * Purpose:
 * - Returns profile meta for the current user (self) or for a given username (public).
 * - Ensures a reliable “Joined” date:
 *    • self → from Supabase Auth `user.created_at`
 *    • public → from `user_profiles.created_at`
 * - Safe cookie handling via @supabase/ssr and no-store caching for fresh data.
 *
 * File: src/app/api/profile/route.ts
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function createClientWithResponse(res: NextResponse) {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => cookieStore.get(n)?.value,
        set: (n, v, o) => res.cookies.set(n, v, o as CookieOptions),
        remove: (n, o) => res.cookies.set(n, "", { ...(o as CookieOptions), maxAge: 0 }),
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createClientWithResponse(res);

  const url = new URL(req.url);
  const targetUsername = (url.searchParams.get("username") || "").trim().toLowerCase();

  const { data: { user } } = await supabase.auth.getUser();
  const selfUsername = String((user?.user_metadata as any)?.username || "").trim().toLowerCase();
  const isPublicView = !!targetUsername && (!user || (selfUsername && selfUsername !== targetUsername));

  if (isPublicView) {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .ilike("username", targetUsername)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    const joinedAt: string | null = profile.created_at ?? null;
    return NextResponse.json(
      { user: null, profile, joinedAt, mode: "public" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const { data: profileRow, error: selErr } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("auth_uid", user.id)
    .maybeSingle();

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let profile = profileRow;
  if (!profile) {
    const { data: created, error: insErr } = await supabase
      .from("user_profiles")
      .insert({
        auth_uid: user.id,
        username: (user.user_metadata as any)?.username || null,
        avatar_url: (user.user_metadata as any)?.avatar_url || null,
      })
      .select()
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    profile = created;
  }

  const joinedAt = user.created_at ?? null;
  return NextResponse.json(
    { user, profile, joinedAt, mode: "self" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createClientWithResponse(res);

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const username = typeof body.username === "string" ? body.username.trim().slice(0, 32) : undefined;
  const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : undefined;

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({ auth_uid: user.id, username: username ?? null, avatar_url: avatarUrl ?? null }, { onConflict: "auth_uid" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true, profile: data }, { headers: { "Cache-Control": "no-store" } });
}
