// src/app/api/auth/signout/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

async function createClientWithResponse(res: NextResponse) {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options as CookieOptions)
          );
        },
      },
    }
  );
}

export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  const supabase = await createClientWithResponse(res);
  await supabase.auth.signOut();
  return res;
}
