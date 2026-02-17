// src/lib/dedupe.ts
export type FeedItem = {
  mangaId: string;
  chapterId: string;
  // ... diğer alanlar sorun değil
};

/** Keep latest item per (mangaId:chapterId) and preserve order */
export function dedupeFeed<T extends FeedItem>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (let i = 0; i < arr.length; i++) {
    const it = arr[i];
    const k = `${it.mangaId}:${it.chapterId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}
