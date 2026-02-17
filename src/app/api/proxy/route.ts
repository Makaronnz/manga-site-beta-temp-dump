// /src/app/api/proxy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyProxyParams } from "@/lib/proxy-sign";

const ALLOW_HOSTS = new Set([
  "uploads.mangadex.org",
  "mangadex.org",
  "bato.to",
  "manganato.com",
  "i.imgur.com"
]);

export const dynamic = "force-dynamic";
// export const runtime = 'edge'; // (Opsiyonel) Cloudflare/edge ortamında zorunlu kılmak istersen aç

export async function GET(req: NextRequest) {
  try {
    const u = req.nextUrl.searchParams.get("u");
    const sig = req.nextUrl.searchParams.get("sig");
    if (!u || !sig || !(await verifyProxyParams(u, sig))) {
      return new NextResponse("Bad signature", { status: 400 });
    }
    const raw = typeof Buffer !== "undefined"
      ? Buffer.from(u, "base64").toString()
      // @ts-ignore
      : decodeURIComponent(escape(atob(u)));
    const target = new URL(raw);

    if (!ALLOW_HOSTS.has(target.hostname)) {
      return new NextResponse("Host not allowed", { status: 403 });
    }

    const upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent": "MakaronComiks/1.0",
        "Referer": target.origin + "/",
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8"
      },
      // Cloudflare cache hint (ignored elsewhere)
      // @ts-ignore
      cf: { cacheEverything: true }
    });

    const res = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
        ...(upstream.headers.get("ETag") ? { ETag: upstream.headers.get("ETag")! } : {})
      }
    });

    return res;
  } catch {
    return new NextResponse("Proxy error", { status: 502 });
  }
}
