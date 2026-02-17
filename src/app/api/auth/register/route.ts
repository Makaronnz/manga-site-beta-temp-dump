/** info: API – Auth Register (optional integration).
 * Keeps your existing local register flow intact.
 * Additionally (OPTIONAL): if a Supabase service-key is configured, it will
 * try to upsert a row into `public.user_profiles` so that `created_at` is
 * recorded at signup time (for consistent “Joined” on public profiles).
 * This does NOT replace your local auth; failures are swallowed.
 */

// src/app/api/auth/register/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  mkProfile, writeUser, writeSession, writePw,
  readPublicProfiles, writePublicProfiles, hashPw
} from "@/lib/auth";

// Optional Supabase mirror insert (service role)
import { supabaseService } from "@/lib/supabase-route";

export async function POST(req: Request) {
  try {
    const { username, email, password } = await req.json() as any;
    if (!username || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const uname = String(username).trim();
    if (!/^[a-z0-9_\. -]{3,32}$/i.test(uname)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    const pub = readPublicProfiles(req.headers.get("cookie") || "");
    if (pub[uname]) {
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }

    const profile = mkProfile(uname, email || undefined);
    const res = NextResponse.json({ ok: true, user: { id: profile.id, username: profile.username } });

    // persist local
    const hpw = await hashPw(String(password));
    writeUser(res, profile);
    writeSession(res, { id: profile.id, username: profile.username });
    writePw(res, { username: profile.username, hash: hpw });

    // public directory
    pub[profile.username] = { ...profile, email: undefined };
    writePublicProfiles(res, pub);

    // OPTIONAL: mirror into Supabase user_profiles (best-effort, ignored on failure)
    try {
      const svc = supabaseService();
      if (svc) {
        await svc
          .from("user_profiles")
          .upsert(
            {
              auth_uid: profile.id,              // assumes mkProfile id is UUID-v4; otherwise this will be just a mirror
              username: profile.username,
              avatar_url: null,
              created_at: new Date().toISOString(),
            },
            { onConflict: "auth_uid" }
          );
      }
    } catch {
      // ignore – optional mirror
    }

    return res;
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
