// src/app/api/comments/route.ts
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
  const seriesId = url.searchParams.get("seriesId");
  const chapterId = url.searchParams.get("chapterId");

  let q = supabase
    .from("comments")
    .select(
      "id, user_id, series_id, chapter_id, content, created_at, user_profiles: user_id (username, avatar_url)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (chapterId) q = q.eq("chapter_id", Number(chapterId));
  else if (seriesId) q = q.eq("series_id", Number(seriesId));
  else return NextResponse.json({ error: "seriesId or chapterId required" }, { status: 400 });

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createClientWithResponse(res);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as any;
  const { seriesId, chapterId, content } = body || {};
  if (!content || (!seriesId && !chapterId)) {
    return NextResponse.json({ error: "content and seriesId/chapterId required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      user_id: user.id,
      series_id: seriesId ? Number(seriesId) : null,
      chapter_id: chapterId ? Number(chapterId) : null,
      content: String(content).slice(0, 2000),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}
