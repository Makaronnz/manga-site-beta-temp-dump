// src/app/api/series/list/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

// ---- helpers (cookie okuma, güvenli varsayılanlar) ----
function getCookie(h: Headers | any, name: string): string | null {
  const all = (typeof h?.get === "function" ? h.get("cookie") : h?.cookie) || "";
  const m = all.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function allowedRatingsFromHeaders(h: Headers | any): string[] {
  // cookie: mc_ratings = ["safe","suggestive","erotica"] gibi
  const raw = getCookie(h, "mc_ratings");
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
  }
  // varsayılan: +18 olmayan her şey
  return ["safe", "suggestive", "erotica"];
}

function blockedTagsFromHeaders(h: Headers | any): string[] {
  // cookie: mc_blockedTags = ["id1","id2"]
  const raw = getCookie(h, "mc_blockedTags");
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

type Localized = Record<string, string | undefined>;
type MDManga = {
  id: string;
  attributes?: { title?: Localized; year?: number | null };
  relationships?: { id: string; type: string; attributes?: { fileName?: string } }[];
};

const UA = process.env.NEXT_PUBLIC_UA || "MakaronComiks/0.1 (+series/list)";

const pickTitle = (t?: Localized) =>
  t?.en ||
  t?.["ja-ro"] ||
  t?.ja ||
  t?.ko ||
  t?.["zh-hk"] ||
  t?.zh ||
  (t ? (Object.values(t).find(Boolean) as string) : "") ||
  "Untitled";

const coverFromRel = (m: MDManga) => {
  const r = m.relationships?.find((x) => x.type === "cover_art" && x.attributes?.fileName);
  return r ? `https://uploads.mangadex.org/covers/${m.id}/${r.attributes!.fileName}.256.jpg` : null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  const limit = Math.min(Math.max(1, parseInt(sp.get("limit") || "30", 10)), 100);
  const offset = Math.max(0, parseInt(sp.get("offset") || "0", 10));
  const order = sp.get("order") || "latestUploadedChapter";

  const parts: string[] = [
    `limit=${limit}`,
    `offset=${offset}`,
    `includes[]=cover_art`,
    `order[${encodeURIComponent(order)}]=desc`,
  ];

  // title
  if (sp.get("title")) parts.push(`title=${encodeURIComponent(sp.get("title")!)}`);

  // ratings -> query yoksa user cookie > default
  const queryRatings = sp.getAll("ratings");
  const allowed = queryRatings.length ? queryRatings : allowedRatingsFromHeaders((req as any).headers);
  for (const r of allowed) parts.push(`contentRating[]=${encodeURIComponent(r)}`);

  // demographic / status
  sp.getAll("publicationDemographic").forEach((d) => parts.push(`publicationDemographic[]=${encodeURIComponent(d)}`));
  sp.getAll("status").forEach((s) => parts.push(`status[]=${encodeURIComponent(s)}`));

  // language filters
  sp.getAll("originalLanguage").forEach((l) => parts.push(`originalLanguage[]=${encodeURIComponent(l)}`));
  sp.getAll("excludedOriginalLanguage").forEach((l) => parts.push(`excludedOriginalLanguage[]=${encodeURIComponent(l)}`));

  // createdAtSince
  if (sp.get("createdAtSince")) parts.push(`createdAtSince=${encodeURIComponent(sp.get("createdAtSince")!)}`);

  // included/excluded tags from query + blocked tags from user
  sp.getAll("includedTags").forEach((id) => parts.push(`includedTags[]=${encodeURIComponent(id)}`));
  const blocked = new Set([...sp.getAll("excludedTags"), ...blockedTagsFromHeaders((req as any).headers)]);
  for (const id of blocked) parts.push(`excludedTags[]=${encodeURIComponent(id)}`);

  if (sp.get("includedTagsMode")) parts.push(`includedTagsMode=${sp.get("includedTagsMode")}`);
  if (sp.get("excludedTagsMode")) parts.push(`excludedTagsMode=${sp.get("excludedTagsMode")}`);

  // year
  if (sp.get("year")) parts.push(`year=${encodeURIComponent(sp.get("year")!)}`);

  // hasAvailableChapters (UI'de includeWithoutCh=true ise devre dışı bırak)
  const includeWithoutCh = sp.get("includeWithoutCh") === "true";
  if (!includeWithoutCh) parts.push(`hasAvailableChapters=true`);

  const mdUrl = `https://api.mangadex.org/manga?${parts.join("&")}`;

  const res = await fetch(mdUrl, { headers: { "user-agent": UA, accept: "application/json" }, cache: "no-store" });
  if (!res.ok) return NextResponse.json({ items: [], nextOffset: offset }, { status: 200 });

  const j = (await res.json()) as { data?: MDManga[]; offset?: number; limit?: number };
  const items = (j.data ?? []).map((m) => ({
    id: m.id,
    title: pickTitle(m.attributes?.title),
    cover: coverFromRel(m),
    year: m.attributes?.year ?? null,
  }));

  const nextOffset = (j.offset ?? offset) + (j.limit ?? limit);
  return NextResponse.json({ items, nextOffset }, { headers: { "Cache-Control": "no-store" } });
}
