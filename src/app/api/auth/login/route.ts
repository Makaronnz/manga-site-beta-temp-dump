export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { readPw, readPublicProfiles, writeSession, hashPw } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json() as any;
    if (!username || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const uname = String(username).trim();
    const pwrec = readPw(req.headers.get("cookie") || "");
    const pub = readPublicProfiles(req.headers.get("cookie") || "");

    if (!pwrec || pwrec.username !== uname) {
      return NextResponse.json({ error: "User not found (demo store)" }, { status: 404 });
    }
    const hpw = await hashPw(String(password));
    if (hpw !== pwrec.hash) {
      return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }
    const prof = pub[uname];
    if (!prof) {
      return NextResponse.json({ error: "Profile not found (demo store)" }, { status: 404 });
    }

    const res = NextResponse.json({ ok: true });
    writeSession(res, { id: prof.id, username: prof.username });
    return res;
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
