// src/app/api/latest/route.ts
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/** Types */
type LocalizedString = Record<string, string | undefined>;
type Relationship = { id: string; type: string };

type Chapter = {
  id: string;
  attributes: {
    chapter: string | null;
    readableAt?: string | null;
    publishAt?: string | null;
    createdAt?: string | null;
  };
  relationships: Relationship[];
};
type MangaEntity = { id: string; attributes?: { title?: LocalizedString } };
type CoverEntity = { attributes?: { fileName?: string }; relationships?: Relationship[] };

/** Helpers */
function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function pickTitle(attr: { title?: LocalizedString } | undefined): string {
  const t = attr?.title ?? {};
  return t['en'] || t['ja-ro'] || t['ja'] || t['ko'] || t['zh-hk'] || t['zh'] || 'Untitled';
}
async function safeJson<T>(res: Response): Promise<T | null> {
  try { return (await res.json()) as T; } catch { return null; }
}
const bestTime = (a: Chapter["attributes"]) =>
  a.readableAt || a.publishAt || a.createdAt || null;

/** Route */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '24', 10) || 24, 60));

    // 1) En güncel chapter’lar (okunabilirliğe göre sırala)
    const chapterUrl =
      'https://api.mangadex.org/chapter'
      + `?limit=${Math.min(limit * 3, 100)}`
      + '&translatedLanguage[]=en'
      + '&includes[]=manga'
      + '&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica'
      + '&order[readableAt]=desc';

    let chapters: Chapter[] = [];
    try {
      const r = await fetch(chapterUrl, {
        headers: { accept: 'application/json', 'user-agent': 'manga-site/1.0 (Cloudflare Workers; Next.js)' },
        cache: 'no-store',
      });
      const j = r.ok ? await safeJson<{ data?: Chapter[] }>(r) : null;
      chapters = j?.data ?? [];
    } catch {
      return NextResponse.json({ items: [] });
    }

    // 2) Her manga için tek en güncel bölüm
    const seen = new Set<string>();
    const latest: Array<{ mangaId: string; chapterId: string; chapter: string | null; publishAt: string | null }> = [];
    for (const ch of chapters) {
      const relManga = ch.relationships.find((r) => r.type === 'manga');
      if (!relManga) continue;
      const mId = relManga.id;
      if (seen.has(mId)) continue;
      seen.add(mId);
      latest.push({
        mangaId: mId,
        chapterId: ch.id,
        chapter: ch.attributes.chapter ?? null,
        publishAt: bestTime(ch.attributes),
      });
      if (latest.length >= limit) break;
    }
    if (latest.length === 0) return NextResponse.json({ items: [] });

    // 3) Başlıklar
    const mangaIds = latest.map((l) => l.mangaId);
    const titleMap = new Map<string, string>();
    try {
      const r = await fetch(
        `https://api.mangadex.org/manga?${mangaIds.map((id) => `ids[]=${id}`).join('&')}&limit=${latest.length}`,
        { headers: { accept: 'application/json', 'user-agent': 'manga-site/1.0 (Cloudflare Workers; Next.js)' }, cache: 'no-store' }
      );
      if (r.ok) {
        const j = await safeJson<{ data?: MangaEntity[] }>(r);
        for (const m of j?.data ?? []) titleMap.set(m.id, pickTitle(m.attributes));
      }
    } catch { /* ignore */ }

    // 4) Kapaklar
    const coverMap = new Map<string, string>();
    for (const group of chunk(mangaIds, 100)) {
      try {
        const r = await fetch(
          `https://api.mangadex.org/cover?limit=100&${group.map((id) => `manga[]=${id}`).join('&')}`,
          { headers: { accept: 'application/json', 'user-agent': 'manga-site/1.0 (Cloudflare Workers; Next.js)' }, cache: 'no-store' }
        );
        if (!r.ok) continue;
        const j = await safeJson<{ data?: CoverEntity[] }>(r);
        for (const c of j?.data ?? []) {
          const rel = (c.relationships ?? []).find((r) => r.type === 'manga');
          const mId = rel?.id, fileName = c.attributes?.fileName;
          if (!mId || !fileName || coverMap.has(mId)) continue;
          coverMap.set(mId, `https://uploads.mangadex.org/covers/${mId}/${fileName}.256.jpg`);
        }
      } catch { /* ignore */ }
    }

    // 5) Response
    const items = latest.map((l) => ({
      mangaId: l.mangaId,
      chapterId: l.chapterId,
      chapter: l.chapter,
      publishAt: l.publishAt,
      title: titleMap.get(l.mangaId) ?? 'Untitled',
      cover: coverMap.get(l.mangaId) ?? null,
    }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
