// Helpers for avatar URLs + fallback placeholder SVG

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!; // required
const DEFAULT_KEY = "defaults/1.webp";

/**
 * Public URL veya path'i storage key'e çevirir.
 * Örn:
 *  - https://<proj>.supabase.co/storage/v1/object/public/avatars/uid/ts.webp -> uid/ts.webp
 *  - /storage/v1/object/public/avatars/uid/ts.webp -> uid/ts.webp
 *  - avatars/uid/ts.webp -> uid/ts.webp
 *  - uid/ts.webp -> uid/ts.webp
 */
export function toStoragePath(input?: string | null): string | null {
  if (!input) return null;
  let v = String(input).trim();
  if (!v) return null;

  // Absolute public URL
  let m = v.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/i);
  if (m) v = m[1];

  // Relative public URL
  if (v.startsWith("/storage/v1/object/public/avatars/")) {
    v = v.slice("/storage/v1/object/public/avatars/".length);
  }

  // Legacy/extra prefixes
  if (v.startsWith("avatars/")) v = v.slice("avatars/".length);
  v = v.replace(/^\/+/, ""); // leading slash

  if (!v) return null;
  return v;
}

/**
 * Eski değerleri normalize et -> storage key veya absolute URL aynen döner.
 * - Legacy local defaults -> bucket default
 * - Absolute URL ise aynen döner (yeniden kurmayız)
 */
export function normalizeAvatarPath(value?: string | null): string | null {
  if (!value) return null;
  let v = String(value).trim();
  if (!v) return null;

  // Absolute URL ise aynen döndür
  if (/^https?:\/\//i.test(v)) return v;

  // Legacy/local defaultları bucket default'una çevir
  if (
    v === "images/avatar-default.png" ||
    v === "images/avatar-default.webp" ||
    v === "avatar-default.png" ||
    v === "avatar-default.webp"
  ) {
    return DEFAULT_KEY;
  }

  // Public URL veya path'i key'e indir
  const key = toStoragePath(v);
  return key || null;
}

/**
 * Storage key veya absolute URL alır; her durumda absolute public URL döndürür.
 * cacheBust verildiğinde "?v=..." ekleyerek cache'i kırar.
 */
export function resolveAvatarUrl(src?: string | null, cacheBust?: number): string | null {
  const norm = normalizeAvatarPath(src) ?? DEFAULT_KEY;

  if (/^https?:\/\//i.test(norm)) {
    // Zaten absolute public URL
    return cacheBust ? `${norm}${norm.includes("?") ? "&" : "?"}v=${cacheBust}` : norm;
  }

  const url = `${SB_URL}/storage/v1/object/public/avatars/${norm}`;
  return cacheBust ? `${url}?v=${cacheBust}` : url;
}

/**
 * İlk harfli placeholder (data URL)
 */
export function avatarPlaceholderDataUrl(name?: string) {
  const ch = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const svg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>
      <rect width='100%' height='100%' fill='#2a2a2a'/>
      <text x='50%' y='58%' dominant-baseline='middle' text-anchor='middle'
        font-family='Inter,system-ui,Arial' font-size='64' fill='#bdbdbd'>${ch}</text>
    </svg>`
  );
  return `data:image/svg+xml;charset=utf-8,${svg}`;
}
