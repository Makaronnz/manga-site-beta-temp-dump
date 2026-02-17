// src/app/api/trending/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * MakaronComiks Trending API
 * Kaynak: MangaDex
 * - Son X günde güncellenen chapter'ları çek
 * - Seri (manga) düzeyine indir
 * - MangaDex statistics ile (follows, rating.bayesian) zenginleştir
 * - Skorla: recency (half-life), follows, chapter-velocity, rating (wilson proxy / bayesian)
 * - NSFW/doujin/çok yeni/az takipçili filtreleri uygula
 *
 * Query:
 *  - lang=tr|en|...|any  (default: en)
 *  - days=3              (default: 3)
 *  - limit=50            (default: 50)
 */

type MDList<T> = {
  result: "ok" | "error";
  data: T[];
  limit: number;
  offset: number;
  total?: number;
};

type MDRel = { id: string; type: string; attributes?: any };
type MDChapter = {
  id: string;
  attributes: {
    chapter?: string;
    readableAt?: string;
    publishAt?: string | null;
    createdAt?: string;
    pages?: number;
    externalUrl?: string | null;
  };
  relationships: MDRel[];
};

type MDManga = {
  id: string;
  attributes: {
    title: Record<string, string>;
    contentRating?: "safe" | "suggestive" | "erotica" | "pornographic";
    originalLanguage?: string; // "ja" | "ko" | "zh" | ...
    publicationDemographic?: "shounen" | "seinen" | "josei" | "shoujo" | null;
    tags?: Array<{ attributes?: { name?: Record<string, string> } }>;
  };
  relationships: MDRel[];
};

type MDStatsResp = {
  result: "ok";
  statistics: Record<
    string,
    {
      rating?: { average?: number; bayesian?: number };
      follows?: number;
      comments?: number;
    }
  >;
};

function toNum(v?: string) {
  const n = Number((v || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const log1p = (x: number) => Math.log(1 + Math.max(0, x));

async function fetchChaptersSince(
  days: number,
  lang: string,
  hardLimit = 1000
): Promise<MDChapter[]> {
  // MangaDex chapter API: order[readableAt]=desc, translatedLanguage[]=xx
  // createdAtSince/readableAtSince param'ı yoksa, zaman filtrelemesini biz yapacağız.
  const PAGE = 100;
  const out: MDChapter[] = [];
  let offset = 0;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  // En fazla hardLimit adet bölüm çek
  for (let i = 0; i < Math.ceil(hardLimit / PAGE); i++) {
    const url =
      `https://api.mangadex.org/chapter?limit=${PAGE}` +
      `&order[readableAt]=desc` +
      (lang && lang !== "any" ? `&translatedLanguage[]=${encodeURIComponent(lang)}` : "") +
      `&includes[]=manga&offset=${offset}`;

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) break;
    const j = (await r.json()) as MDList<MDChapter>;
    const chunk = (j.data || []).filter(Boolean);

    out.push(...chunk);
    offset += chunk.length;

    // Erken dur: listedeki en eski kayıt bile cutoff'tan eskiyse kır
    const oldest = chunk[chunk.length - 1];
    const t =
      Date.parse(oldest?.attributes?.readableAt || "") ||
      Date.parse(oldest?.attributes?.publishAt || "") ||
      Date.parse(oldest?.attributes?.createdAt || "");
    if (!chunk.length || t < cutoff) break;
    if (out.length >= hardLimit) break;
  }
  // kesin filtre
  return out.filter((ch) => {
    const t =
      Date.parse(ch.attributes?.readableAt || "") ||
      Date.parse(ch.attributes?.publishAt || "") ||
      Date.parse(ch.attributes?.createdAt || "");
    return t >= cutoff;
  });
}

async function fetchMangaDetails(ids: string[]): Promise<MDManga[]> {
  const out: MDManga[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const url =
      `https://api.mangadex.org/manga?limit=${chunk.length}` +
      chunk.map((id) => `&ids[]=${id}`).join("") +
      `&includes[]=cover_art`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) continue;
    const j = (await r.json()) as MDList<MDManga>;
    out.push(...(j.data || []));
  }
  return out;
}

async function fetchMangaStats(ids: string[]): Promise<MDStatsResp["statistics"]> {
  const stats: MDStatsResp["statistics"] = {};
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const url = `https://api.mangadex.org/statistics/manga?` + chunk.map((id) => `manga[]=${id}`).join("&");
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) continue;
    const j = (await r.json()) as MDStatsResp;
    Object.assign(stats, j.statistics || {});
  }
  return stats;
}

function isNSFW(m: MDManga) {
  const cr = m.attributes?.contentRating;
  if (cr === "erotica" || cr === "pornographic") return true;
  // Etiket bazlı ekstra temizlik istersek buraya ekleyebiliriz.
  return false;
}

function coverUrlOf(m: MDManga): string | null {
  const rel = (m.relationships || []).find((r) => r.type === "cover_art");
  const file = rel?.attributes?.fileName;
  return file ? `https://uploads.mangadex.org/covers/${m.id}/${file}.512.jpg` : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = (searchParams.get("lang") || "en").toLowerCase();
    const days = Math.max(1, Math.min(14, Number(searchParams.get("days") || 3)));
    const limit = Math.max(10, Math.min(100, Number(searchParams.get("limit") || 50)));

    // 1) Son X günün chapter’ları
    const chapters = await fetchChaptersSince(days, lang);

    // 2) Manga düzeyine indirgeme
    type Agg = {
      mangaId: string;
      lastAt: number; // ms
      lastChapNum: number;
      lastChapStr: string | null;
      pagesLastChap: number;
      externalCount: number;
      count24h: number;
      count72h: number;
      totalInWindow: number;
    };
    const byManga = new Map<string, Agg>();

    const now = Date.now();
    for (const ch of chapters) {
      const mangaRel = (ch.relationships || []).find((r) => r.type === "manga");
      if (!mangaRel) continue;
      const mid = mangaRel.id;

      const t =
        Date.parse(ch.attributes?.readableAt || "") ||
        Date.parse(ch.attributes?.publishAt || "") ||
        Date.parse(ch.attributes?.createdAt || "") ||
        0;
      const num = toNum(ch.attributes?.chapter);
      const pages = ch.attributes?.pages || 0;
      const isExternal = !!ch.attributes?.externalUrl;

      const agg = byManga.get(mid) || {
        mangaId: mid,
        lastAt: 0,
        lastChapNum: 0,
        lastChapStr: null,
        pagesLastChap: 0,
        externalCount: 0,
        count24h: 0,
        count72h: 0,
        totalInWindow: 0,
      };
      if (t > agg.lastAt) {
        agg.lastAt = t;
        agg.lastChapNum = num;
        agg.lastChapStr = ch.attributes?.chapter || null;
        agg.pagesLastChap = pages;
      }
      agg.externalCount += isExternal ? 1 : 0;
      const ageH = (now - t) / 36e5;
      if (ageH <= 24) agg.count24h++;
      if (ageH <= 72) agg.count72h++;
      agg.totalInWindow++;
      byManga.set(mid, agg);
    }

    const mangaIds = Array.from(byManga.keys());

    // 3) Manga detayları ve istatistikleri
    const [details, stats] = await Promise.all([fetchMangaDetails(mangaIds), fetchMangaStats(mangaIds)]);
    const detailById = new Map(details.map((m) => [m.id, m]));

    // 4) Skor
    const HALF_LIFE_H = 48; // recency yarılanma süresi
    const FOL_MIN = 150; // min takipçi (gürültü filtresi)
    const MIN_PAGES = 6; // son bölüm çok kısa ise eleyelim
    const EXT_PENALTY = 0.15; // sadece dış link basanlara ceza

    type Out = {
      id: string;
      title: string;
      cover: string | null;
      score: number;
      reasons: Record<string, number>;
      lastAt: string | null;
      lastChapter: string | null;
      lang: string;
      follows: number;
      rating: number | null;
      format: "manga" | "manhwa" | "manhua" | "other";
    };

    const out: Out[] = [];

    for (const id of mangaIds) {
      const d = detailById.get(id);
      if (!d) continue;
      if (isNSFW(d)) continue;

      const a = byManga.get(id)!;
      const st = stats[id] || {};
      const follows = st.follows || 0;
      const rating = st.rating?.bayesian ?? st.rating?.average ?? null;

      if (follows < FOL_MIN) continue;
      if (a.pagesLastChap && a.pagesLastChap < MIN_PAGES) continue;

      // Recency decay
      const ageH = (now - a.lastAt) / 36e5;
      const recency = Math.pow(0.5, ageH / HALF_LIFE_H); // 0..1

      // Format boost (opsiyonel)
      const ol = (d.attributes?.originalLanguage || "").toLowerCase();
      const format: Out["format"] =
        ol === "ko" ? "manhwa" : ol.startsWith("zh") ? "manhua" : ol === "ja" ? "manga" : "other";
      const formatBoost = format === "manhwa" ? 1.15 : format === "manhua" ? 1.08 : 1.0;

      // Chapter velocity (pencere içinde kaç tane geldiği)
      const v24 = a.count24h;
      const v72 = a.count72h;
      const vTotal = a.totalInWindow;

      // Dış link cezası (okuma dışarı atıyorsa)
      const extPenalty = a.externalCount > 0 ? EXT_PENALTY : 0;

      // Normalize + Ağırlıklar
      const F = log1p(follows); // büyüklük farkını sıkıştır
      const R = rating ? clamp01((rating - 5) / 5) : 0.5; // ~0..1 (5→0, 10→1 varsayım)
      const V = Math.min(1, v24 * 0.6 + (v72 - v24) * 0.25 + (vTotal - v72) * 0.1);

      const base =
        0.55 * F + // takipçi gücü
        0.25 * V + // yakın dönem bölüm hızı
        0.20 * R; // kalite sinyali

      const score = (base * recency * formatBoost) * (1 - extPenalty);

      out.push({
        id,
        title: d.attributes?.title?.en || Object.values(d.attributes?.title || {})[0] || "Untitled",
        cover: coverUrlOf(d),
        score,
        reasons: { F, V, R, recency, formatBoost, extPenalty },
        lastAt: a.lastAt ? new Date(a.lastAt).toISOString() : null,
        lastChapter: a.lastChapStr,
        lang,
        follows,
        rating,
        format,
      });
    }

    out.sort((a, b) => b.score - a.score);
    const limited = out.slice(0, limit);

    return NextResponse.json({ items: limited, total: out.length, took: limited.length, lang, days });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
