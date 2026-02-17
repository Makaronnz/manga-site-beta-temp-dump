// src/lib/filters.ts
// MakaronComiks — global içerik filtreleri

/** Sitede asla görünmeyecek seri ID'leri (MangaDex title id) */
export const EXCLUDED_MANGA_IDS = new Set<string>([
  // Official Test Manga
  "f9c33607-9180-4ba6-b85c-e4b5faee7192",
]);

/** Dizi/iterable içinden id alanlarına göre kara liste filtresi */
export function filterOutExcluded<T extends { id: string }>(arr: T[]): T[] {
  return arr.filter((x) => !EXCLUDED_MANGA_IDS.has(x.id));
}
