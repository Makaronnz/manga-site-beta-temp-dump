// src/app/api/series/tags/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type Localized = Record<string, string | undefined>;

export async function GET() {
  try {
    const res = await fetch("https://api.mangadex.org/manga/tag", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ tags: [] });
    const j = (await res.json()) as {
      data?: { id: string; attributes?: { group?: string; name?: Localized } }[];
    };
    const tags =
      (j?.data ?? []).map((t) => ({
        id: t.id,
        group: t.attributes?.group ?? "",
        name:
          t.attributes?.name?.en ??
          t.attributes?.name?.["ja-ro"] ??
          t.attributes?.name?.ja ??
          t.attributes?.name?.ko ??
          t.attributes?.name?.["zh-hk"] ??
          t.attributes?.name?.zh ??
          "Tag",
      })) ?? [];
    return NextResponse.json({ tags });
  } catch {
    return NextResponse.json({ tags: [] });
  }
}
