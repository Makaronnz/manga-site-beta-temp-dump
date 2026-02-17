// src/server/catalog.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SeriesMeta, ChapterMeta, PageMeta } from "./sources/base";

export async function upsertSeriesFrom(meta: SeriesMeta, sourceKey: string) {
  const db = await createSupabaseServerClient(); // ← await

  const slug =
    meta.slug ||
    meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const { data: s1, error: e1 } = await db
    .from("series")
    .upsert(
      {
        slug,
        title: meta.title,
        description: meta.description,
        cover_url: meta.coverUrl,
        year: meta.year ?? null,
        status: meta.status ?? null,
        lang: meta.lang ?? null,
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (e1) throw e1;

  const { data: src, error: srcErr } = await db
    .from("sources")
    .select("id")
    .eq("key", sourceKey)
    .maybeSingle();
  if (srcErr) throw srcErr;
  if (!src) throw new Error(`Source not found: ${sourceKey}`);

  const { error: linkErr } = await db.from("series_sources").upsert(
    {
      series_id: s1.id,
      source_id: src.id,
      external_id: meta.externalId,
      external_url: meta.externalUrl ?? null,
    },
    { onConflict: "series_id,source_id" }
  );
  if (linkErr) throw linkErr;

  return s1;
}

export async function upsertChapters(
  seriesId: number,
  chapters: ChapterMeta[],
  sourceKey: string
) {
  const db = await createSupabaseServerClient(); // ← await

  const { data: src, error: srcErr } = await db
    .from("sources")
    .select("id")
    .eq("key", sourceKey)
    .maybeSingle();
  if (srcErr) throw srcErr;
  if (!src) throw new Error(`Source not found: ${sourceKey}`);

  for (const ch of chapters) {
    const { data: cRow, error } = await db
      .from("chapters")
      .upsert(
        {
          series_id: seriesId,
          number: ch.number,
          title: ch.title ?? null,
          lang: ch.lang ?? null,
          published_at: ch.publishedAt
            ? new Date(ch.publishedAt as any).toISOString()
            : null,
        },
        { onConflict: "series_id,number" }
      )
      .select()
      .single();
    if (error) throw error;

    const { error: linkErr } = await db.from("chapter_sources").upsert(
      {
        chapter_id: cRow.id,
        source_id: src.id,
        external_id: ch.externalId,
        external_url: ch.externalUrl ?? null,
      },
      { onConflict: "chapter_id,source_id" }
    );
    if (linkErr) throw linkErr;
  }
}

export async function upsertPages(chapterId: number, pages: PageMeta[]) {
  const db = await createSupabaseServerClient(); // ← await
  const sorted = [...pages].sort((a, b) => a.page - b.page);

  for (const p of sorted) {
    const { error } = await db.from("pages").upsert(
      {
        chapter_id: chapterId,
        page_number: p.page,
        remote_url: p.remoteUrl,
        width: p.width ?? null,
        height: p.height ?? null,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: "chapter_id,page_number" }
    );
    if (error) throw error;
  }
}
