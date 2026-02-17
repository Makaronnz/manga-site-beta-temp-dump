// src/utils.ts
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Başlığı URL-dostu sluga çevirir. */
export function slugify(title: string): string {
  return (title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")     // aksan/komb. işaretleri temizle
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** "my-title-XXXXXXXX-uuid" gibi birleşik paramdan sondaki UUID’yi alır. */
export function extractIdFromSlugish(slugish: string): string {
  // UUID’yi sonda arıyoruz; yoksa son parçayı al.
  const m = slugish.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (m) return m[0];
  const parts = slugish.split("-");
  return parts[parts.length - 1];
}

/** Chapter için "35-CHAPTER_UUID" gibi birleşikten sondaki UUID’yi alır. */
export function extractChapterId(chapterParam: string): string {
  // son tireden sonraki parça UUID ise onu al; değilse tamamı UUID kabul
  const maybe = chapterParam.split("-").pop() || chapterParam;
  return /[0-9a-f-]{36}/i.test(maybe) ? maybe : chapterParam;
}

/** Chapter görünür parçası: "35" ya da "oneshot" */
export function visibleChapterPart(chapter: string | null | undefined): string {
  const v = (chapter ?? "").trim();
  return v ? v : "oneshot";
}
