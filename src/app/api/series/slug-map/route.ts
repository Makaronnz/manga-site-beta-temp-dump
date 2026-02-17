// src/app/api/series/slug-map/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseFromCookiesReadOnly } from "@/lib/supabase-route";
import { hydrateFromMangadex } from "@/lib/series-hydrator";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getMdSourceId(): Promise<number | null> {
  const ro = await supabaseFromCookiesReadOnly();
  const { data } = await ro.from("sources").select("id").eq("key", "mangadex").maybeSingle();
  return data?.id ? Number(data.id) : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsParam = (searchParams.get("ids") || "").trim();
  const hydrate = (searchParams.get("hydrate") || "0") === "1";
  const debug = (searchParams.get("debug") || "0") === "1";

  if (!idsParam) return NextResponse.json({ map: {} });

  // orijinal → lowercase eşlemesi
  const orig = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const lower = orig.map((id) => id.toLowerCase());
  const uniqLower = Array.from(new Set(lower)).slice(0, 100);
  const byLowerToOrig = new Map<string, string[]>();
  lower.forEach((l, i) => {
    const arr = byLowerToOrig.get(l) || [];
    arr.push(orig[i]);
    byLowerToOrig.set(l, arr);
  });

  const ro = await supabaseFromCookiesReadOnly();
  const foundLowerToSlug = new Map<string, string>();
  const errors: Array<{ id: string; error: string }> = [];
  const mdSourceId = await getMdSourceId();

  // 1) DB’de var olanlar (external_id = lowercase)
  if (mdSourceId && uniqLower.length) {
    const { data, error } = await ro
      .from("series_sources")
      .select("external_id, series:series_id ( slug )")
      .eq("source_id", mdSourceId)
      .in("external_id", uniqLower);
    if (error && debug) errors.push({ id: "*", error: `select series_sources: ${error.message}` });
    for (const row of data ?? []) {
      const ext = row.external_id as string | undefined;
      const slug = (row.series as any)?.slug as string | undefined;
      if (ext && slug) foundLowerToSlug.set(ext, slug);
    }
  }

  // 2) Eksikler ve hydrate isteniyorsa → import
  const missingLower = uniqLower.filter((id) => !foundLowerToSlug.has(id));
  if (hydrate && missingLower.length) {
    for (const idLower of missingLower) {
      if (!UUID_V4.test(idLower)) continue;
      try {
        const res = await hydrateFromMangadex(idLower);
        if (res?.slug) foundLowerToSlug.set(idLower, res.slug);
      } catch (e: any) {
        if (debug) errors.push({ id: idLower, error: e?.message || String(e) });
      }
    }
  }

  // 3) Çıktı — orijinal anahtarlarla dön
  const map: Record<string, string> = {};
  for (const [low, slug] of foundLowerToSlug.entries()) {
    const originals = byLowerToOrig.get(low) || [];
    for (const o of originals) map[o] = slug;
  }
  const body: any = { map };
  if (debug) body.debug = { errors };
  return NextResponse.json(body);
}
