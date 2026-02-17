// src/lib/series-hydrator.ts
import { supabaseFromCookies, supabaseService } from "@/lib/supabase-route";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MDLocalized = Record<string, string | undefined>;

function slugify(input: string): string {
  const base = (input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "untitled";
}

function pickTitle(t?: MDLocalized, fallbacks: MDLocalized[] = []): string {
  const chain = [t, ...fallbacks];
  for (const obj of chain) {
    if (!obj) continue;
    for (const key of ["en", "ja-ro", "ja", "ko", "zh-hk", "zh"]) {
      const v = obj[key];
      if (v) return v;
    }
    const any = Object.values(obj).find(Boolean);
    if (any) return String(any);
  }
  return "Untitled";
}

async function fetchMD(uuidLower: string) {
  try {
    const r = await fetch(
      `https://api.mangadex.org/manga/${uuidLower}?includes[]=cover_art`,
      { headers: { accept: "application/json", "user-agent": "MakaronComiks/1.0" }, cache: "no-store" }
    );
    if (!r.ok) {
      console.warn(`[hydrator] fetchMD error ${r.status} for ${uuidLower}`);
      throw new Error(`mangadex_upstream_${r.status}`);
    }
    const j = (await r.json()) as {
      data?: {
        id: string;
        attributes?: {
          title?: MDLocalized;
          altTitles?: MDLocalized[];
          description?: MDLocalized;
        };
        relationships?: { type: string; id: string; attributes?: any }[];
      };
    };
    if (!j?.data) throw new Error("mangadex_not_found");

    const coverRel = (j.data.relationships || []).find((rel) => rel.type === "cover_art");
    const file = coverRel?.attributes?.fileName as string | undefined;
    const coverUrl = file ? `https://uploads.mangadex.org/covers/${uuidLower}/${file}.512.jpg` : null;
    const title = pickTitle(j.data.attributes?.title, j.data.attributes?.altTitles || []);

    return { title, coverUrl };
  } catch (e) {
    console.error("[hydrator] fetchMD final error:", e);
    throw e;
  }
}

async function getOrCreateSourceId(db: any): Promise<number> {
  const found = await db.from("sources").select("id").eq("key", "mangadex").maybeSingle();
  if (found.data?.id) return Number(found.data.id);
  const ins = await db.from("sources").insert({ key: "mangadex", display_name: "MangaDex" }).select("id").single();
  if (ins.error) throw ins.error;
  return Number(ins.data.id);
}

async function ensureUniqueSlug(db: any, base: string): Promise<string> {
  let slug = base || "untitled";
  for (let i = 0; i < 50; i++) {
    const trySlug = i === 0 ? slug : `${slug}-${i + 1}`;
    const { data } = await db.from("series").select("id").eq("slug", trySlug).limit(1);
    if (!data || data.length === 0) return trySlug;
  }
  return `${slug}-${Date.now()}`;
}

/** DB’de yoksa, MD’den çekip series + series_sources’a ekler. */
export async function hydrateFromMangadex(uuid: string): Promise<{ id: number; slug: string; mdId: string }> {
  if (!UUID_V4.test(uuid)) throw new Error("invalid_uuid");

  // ✅ her zaman lowercase ile çalış
  const uuidLower = uuid.toLowerCase();

  // Service varsa onu kullan, yoksa kullanıcı oturumu ile dene
  const svc = supabaseService();
  const db = svc ?? (await supabaseFromCookies());

  const sourceId = await getOrCreateSourceId(db);

  // Zaten eşlenmiş mi?
  const exists = await db
    .from("series_sources")
    .select("series_id")
    .eq("source_id", sourceId)
    .eq("external_id", uuidLower)
    .maybeSingle();
  if (exists.data?.series_id) {
    const s = await db.from("series").select("id, slug").eq("id", exists.data.series_id).maybeSingle();
    if (s.data) {
      return { id: Number(s.data.id), slug: s.data.slug, mdId: uuidLower };
    } else {
      // ORPHAN DETECTED! Source points to missing series.
      console.warn(`[hydrator] Orphan source found for ${uuidLower} -> series ${exists.data.series_id}. Cleaning up...`);
      await db.from("series_sources").delete().eq("source_id", sourceId).eq("external_id", uuidLower);
      // Proceed to create new...
    }
  }

  // MD’den al
  const { title, coverUrl } = await fetchMD(uuidLower);

  // slug üret
  const slug = await ensureUniqueSlug(db, slugify(title));

  // series insert
  const ins = await db.from("series").insert({ slug, title, cover_url: coverUrl }).select("id").single();
  if (ins.error) throw ins.error;
  const sid = Number(ins.data.id);

  // series_sources insert (external_id = lowercase!)
  const mdUrl = `https://mangadex.org/title/${uuidLower}`;
  const link = await db
    .from("series_sources")
    .insert({ series_id: sid, source_id: sourceId, external_id: uuidLower, external_url: mdUrl })
    .select("id")
    .single();
  if (link.error) throw link.error;

  return { id: sid, slug, mdId: uuidLower };
}

async function findMDByTitle(title: string): Promise<string | null> {
  try {
    const url = new URL("https://api.mangadex.org/manga");
    url.searchParams.set("title", title);
    url.searchParams.set("limit", "5");
    url.searchParams.set("order[relevance]", "desc");
    const r = await fetch(url.toString(), { headers: { accept: "application/json", "user-agent": "MakaronComiks/1.0" }, cache: "no-store" });
    if (!r.ok) return null;

    const j = (await r.json()) as { data?: { id: string; attributes: { title: MDLocalized } }[] };
    const first = j.data?.[0];
    if (!first) return null;

    // Simple check: if first result title contains our title (ignoring case), accept it.
    // or just return the first relevance match.
    return first.id;
  } catch {
    return null;
  }
}

/** 
 * Tries to find missing MD ID for an existing local series.
 * If found, inserts into series_sources and returns it. 
 */
export async function healMissingSourceLink(seriesId: number, title: string): Promise<string | null> {
  console.log(`[heal] Attempting to find MD ID for "${title}" (id=${seriesId})`);
  const mdId = await findMDByTitle(title);
  if (!mdId) {
    console.warn(`[heal] Could not find any manga on MD for title "${title}"`);
    return null;
  }

  const svc = supabaseService();
  const db = svc ?? (await supabaseFromCookies());

  const sourceId = await getOrCreateSourceId(db);

  // Insert
  const uuidLower = mdId.toLowerCase();
  const mdUrl = `https://mangadex.org/title/${uuidLower}`;

  const { error } = await db.from("series_sources").insert({
    series_id: seriesId,
    source_id: sourceId,
    external_id: uuidLower,
    external_url: mdUrl
  });

  if (error) {
    console.error("[heal] Insert failed:", error);
    // Maybe it exists now?
    return null;
  }

  console.log(`[heal] LINKED! "${title}" -> ${uuidLower}`);
  return uuidLower;
}
