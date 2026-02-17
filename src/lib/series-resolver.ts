// src/lib/series-resolver.ts
import { supabaseFromCookiesReadOnly } from "@/lib/supabase-route";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ResolvedSeries = {
  id: number;   // internal numeric series.id
  slug: string; // canonical MakaronComiks slug
  mdId?: string;
};

async function getMangadexSourceId(): Promise<number | null> {
  const db = await supabaseFromCookiesReadOnly();
  const { data } = await db.from("sources").select("id").eq("key", "mangadex").maybeSingle();
  return data?.id ? Number(data.id) : null;
}

/** slug | uuid | numeric → { id, slug, mdId } */
export async function resolveSeries(raw: string | number): Promise<ResolvedSeries | null> {
  const db = await supabaseFromCookiesReadOnly();
  const key = String(raw || "").trim();
  if (!key) return null;

  // 1) numeric id
  const asNum = Number(key);
  if (Number.isFinite(asNum)) {
    const { data } = await db.from("series").select("id, slug, title").eq("id", asNum).maybeSingle();
    if (!data) return null;

    const mdSourceId = await getMangadexSourceId();
    let mdId: string | undefined = undefined;
    if (mdSourceId) {
      const md = await db
        .from("series_sources")
        .select("external_id")
        .eq("series_id", data.id)
        .eq("source_id", mdSourceId)
        .maybeSingle();
      mdId = md.data?.external_id;

      // AUTO-HEAL
      if (!mdId) {
        try {
          const { healMissingSourceLink } = await import("@/lib/series-hydrator");
          // Use TITLE for better search match
          const val = await healMissingSourceLink(Number(data.id), data.title || data.slug);
          if (val) mdId = val;
        } catch (e) {
          console.error("[resolveSeries] auto-heal failed:", e);
        }
      }
    }

    return { id: Number(data.id), slug: data.slug, mdId };
  }

  // 2) slug
  {
    const { data } = await db.from("series").select("id, slug, title").eq("slug", key.toLowerCase()).maybeSingle();
    if (data) {
      const mdSourceId = await getMangadexSourceId();
      let mdId: string | undefined = undefined;
      if (mdSourceId) {
        const md = await db
          .from("series_sources")
          .select("external_id")
          .eq("series_id", data.id)
          .eq("source_id", mdSourceId)
          .maybeSingle();
        mdId = md.data?.external_id;

        // AUTO-HEAL (slug path)
        if (!mdId) {
          try {
            const { healMissingSourceLink } = await import("@/lib/series-hydrator");
            const val = await healMissingSourceLink(Number(data.id), data.title || data.slug);
            if (val) mdId = val;
          } catch (e) {
            console.error("[resolveSeries] auto-heal failed:", e);
          }
        }
      }
      return { id: Number(data.id), slug: data.slug, mdId };
    }
  }

  // 3) external_id (MD UUID gibi) — ✅ lowercase arama
  {
    const keyLower = key.toLowerCase();
    const mdSourceId = await getMangadexSourceId();
    const q = db.from("series_sources").select("series_id, external_id").eq("external_id", keyLower).limit(1);
    const { data } = mdSourceId ? await q.eq("source_id", mdSourceId).maybeSingle() : await q.maybeSingle();
    if (data?.series_id) {
      const s = await db.from("series").select("id, slug").eq("id", data.series_id).maybeSingle();
      if (s.data) {
        return { id: Number(s.data.id), slug: s.data.slug, mdId: keyLower };
      }
    }
  }

  return null;
}
