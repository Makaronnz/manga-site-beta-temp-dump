// src/app/api/crawl/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/server/sources";
import { upsertSeriesFrom, upsertChapters, upsertPages } from "@/server/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TOKEN = process.env.CRAWL_TOKEN || "";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (TOKEN && req.headers.get("authorization") !== `Bearer ${TOKEN}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as any;
  const { source, seriesExternalId } = body;
  if (!source || !seriesExternalId) {
    return NextResponse.json({ error: "source & seriesExternalId required" }, { status: 400 });
  }

  try {
    const adapter = getAdapter(source);
    const meta = await adapter.fetchSeriesMeta(seriesExternalId);
    const series = await upsertSeriesFrom(meta, source);

    const chapters = await adapter.fetchChapters(seriesExternalId);
    await upsertChapters(series.id, chapters, source);

    const db = await createSupabaseServerClient(); // ← await
    const { data: latest } = await db
      .from("chapters")
      .select("id, number, chapter_sources(external_id)")
      .eq("series_id", series.id)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ext = latest?.chapter_sources?.[0]?.external_id;
    if (ext) {
      const pages = await adapter.fetchPages(ext);
      await upsertPages(latest!.id, pages);
    }

    return NextResponse.json({ ok: true, seriesId: series.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
