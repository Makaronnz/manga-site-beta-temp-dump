// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "uploads.mangadex.org" },
      { protocol: "https", hostname: "*.mangadex.network" },
      { protocol: "https", hostname: "*.mangadex.org" },
      // external sources we may proxy/bypass
      { protocol: "https", hostname: "bato.to" },
      { protocol: "https", hostname: "manganato.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "pxplafyxntictdqkxrsw.supabase.co" }, // ✅ allow Supabase storage
      // ✅ Supabase Storage (avatars)
      { protocol: "https", hostname: "*.supabase.co" }
    ],
    localPatterns: [
      { pathname: "/api/proxy" },
      { pathname: "/api/**" },
      { pathname: "/images/**" },
      { pathname: "/icons/**" },
      { pathname: "/favicon.ico" },
      // ✅ EKLENDİ: placeholder görseline izin ver
      { pathname: "/placeholder-cover.png" }
    ]
  },

  async redirects() {
    return [
      { source: "/manga/:id", destination: "/series/:id", permanent: false },
      { source: "/manga/:id/chapter/:chapterId", destination: "/series/:id/chapter/:chapterId", permanent: false },
      { source: "/api/manga/:path*", destination: "/api/series/:path*", permanent: false }
    ];
  },

  async headers() {
    return [
      {
        source: "/api/proxy",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800" }]
      }
    ];
  }
};

export default nextConfig;
