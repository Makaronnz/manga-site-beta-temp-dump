// src/app/api/home/most-popular-month/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type Localized = Record<string, string | undefined>;

type MDRel = {
  id: string;
  type: string;
  attributes?: { fileName?: string };
};

type MDManga = {
  id: string;
  attributes?: {
    title?: Localized;
    year?: number | null;
    updatedAt?: string;
    originalLanguage?: string | null;
    status?: string | null;
    publicationDemographic?: string | null;
    links?: Record<string, string | undefined>;
  };
  relationships?: MDRel[];
};

type StatResponse = {
  statistics?: Record<
    string,
    {
      rating?: { average?: number | null; bayesian?: number | null };
      follows?: number;
    }
  >;
};

function pickTitle(t?: Localized): string {
  if (!t) return "Untitled";
  return (
    t["en"] ||
    t["ja-ro"] ||
    t["ja"] ||
    t["ko"] ||
    t["zh-hk"] ||
    t["zh"] ||
    Object.values(t).find(Boolean) ||
    "Untitled"
  ) as string;
}

function coverFromRel(id: string, rels?: MDRel[] | null): string | null {
  const r = (rels || []).find((x) => x.type === "cover_art" && x.attributes?.fileName);
  return r ? `https://uploads.mangadex.org/covers/${id}/${r.attributes!.fileName}.256.jpg` : null;
}

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 864e5);
  return d.toISOString();
}

function chunk<T>(arr: T[], size = 80): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "24", 10), 60);
  const metric = (searchParams.get("metric") || "follows").toLowerCase() as "follows" | "rating";
  const days = Math.min(parseInt(searchParams.get("days") || "30", 10), 120); // güvenli üst limit

  // 1) Son X günde güncellenmiş bir havuz çek
  const url = new URL("https://api.mangadex.org/manga");
  url.searchParams.set("limit", "100");
  url.searchParams.set("hasAvailableChapters", "true");
  url.searchParams.set("includes[]", "cover_art");
  url.searchParams.set("updatedAtSince", isoDaysAgo(days));
  url.searchParams.set("order[followedCount]", "desc");
  // İçerik derecelendirmesi: erotica/pornographic hariç
  url.searchParams.append("contentRating[]", "safe");
  url.searchParams.append("contentRating[]", "suggestive");

  const res = await fetch(url.toString(), { headers: { accept: "application/json" }, cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });

  const j = (await res.json()) as { data?: MDManga[] };
  const pool = j.data || [];
  if (!pool.length) return NextResponse.json({ items: [], generatedAt: new Date().toISOString() });

  // "official 'test' manga" gibi test içeriklerini dışla
  const excludeTitleRe = /official\s*['’"]?test['’"]?\s*manga/i;
  const filtered = pool.filter((m) => !excludeTitleRe.test(pickTitle(m.attributes?.title)));

  const ids = filtered.map((m) => m.id);
  // 2) İstatistikler
  const statMap: Record<string, { follows: number; rating: number }> = {};
  for (const group of chunk(ids, 80)) {
    const sUrl = new URL("https://api.mangadex.org/statistics/manga");
    for (const id of group) sUrl.searchParams.append("manga[]", id);
    const sRes = await fetch(sUrl.toString(), { headers: { accept: "application/json" }, cache: "no-store" });
    if (!sRes.ok) continue;
    const sj = (await sRes.json()) as StatResponse;
    const st = sj.statistics || {};
    for (const [id, v] of Object.entries(st)) {
      const follows = v.follows || 0;
      const rating =
        typeof v.rating?.bayesian === "number" ? v.rating!.bayesian! :
        typeof v.rating?.average === "number" ? v.rating!.average! : 0;
      statMap[id] = { follows, rating };
    }
  }

  // 3) Liste
  type Item = {
    id: string;
    title: string;
    year: number | null;
    cover: string | null;
    follows: number;
    rating: number;
    description: string;
  };

  const items: Item[] = filtered.map((m) => {
    const id = m.id;
    const title = pickTitle(m.attributes?.title);
    const year = m.attributes?.year ?? null;
    const cover = coverFromRel(id, m.relationships);
    const stat = statMap[id] || { follows: 0, rating: 0 };
    const description = `❤ ${stat.follows.toLocaleString()} • ★ ${stat.rating.toFixed(2)}`;
    return { id, title, year, cover, follows: stat.follows, rating: stat.rating, description };
  });

  // 4) Sıralama
  const sorter =
    metric === "rating"
      ? (a: Item, b: Item) => b.rating - a.rating || b.follows - a.follows
      : (a: Item, b: Item) => b.follows - a.follows || b.rating - a.rating;

  items.sort(sorter);

  return NextResponse.json({
    items: items.slice(0, limit),
    days,
    metric,
    generatedAt: new Date().toISOString(),
  });
}
