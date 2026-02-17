
import { NextResponse } from "next/server";

export interface Profile {
    id: string;
    username: string;
    email?: string;
    joined_at?: string;
    avatar_url?: string;
}

export function mkProfile(username: string, email?: string): Profile {
    return {
        id: crypto.randomUUID(),
        username,
        email,
        joined_at: new Date().toISOString(),
    };
}

// Cookie helpers
const COOKIE_OPTS = { path: "/", httpOnly: true, sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 30 };
const PUBLIC_COOKIE_OPTS = { ...COOKIE_OPTS, httpOnly: false }; // Accessible to client if needed

export function writeUser(res: NextResponse, profile: Profile) {
    // In a real app, this would be DB. Here we just set a cookie for the current user.
    res.cookies.set("mc_user", JSON.stringify(profile), PUBLIC_COOKIE_OPTS);
}

export function writeSession(res: NextResponse, session: { id: string; username: string }) {
    res.cookies.set("mc_session", JSON.stringify(session), COOKIE_OPTS);
}

export function writePw(res: NextResponse, data: { username: string; hash: string }) {
    // VERY INSECURE: Storing password hash in a cookie allows anyone with the cookie to know the hash.
    // This is strictly for the "demo" requirement where no DB exists.
    // We store it as a JSON specific to this user, but really this only supports 1 user per browser.
    res.cookies.set("mc_pw", JSON.stringify(data), COOKIE_OPTS);
}

export function readPw(cookieHeader: string): { username: string; hash: string } | null {
    const match = cookieHeader.match(/mc_pw=([^;]+)/);
    if (!match) return null;
    try {
        const dec = decodeURIComponent(match[1]);
        return JSON.parse(dec);
    } catch {
        return null;
    }
}

export function readPublicProfiles(cookieHeader: string): Record<string, Profile> {
    // Reads a "public directory" stored in a cookie. Size limited!
    const match = cookieHeader.match(/mc_pub=([^;]+)/);
    if (!match) return {};
    try {
        const dec = decodeURIComponent(match[1]);
        return JSON.parse(dec);
    } catch {
        return {};
    }
}

export function writePublicProfiles(res: NextResponse, profiles: Record<string, Profile>) {
    res.cookies.set("mc_pub", JSON.stringify(profiles), PUBLIC_COOKIE_OPTS);
}

export async function hashPw(password: string): Promise<string> {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
