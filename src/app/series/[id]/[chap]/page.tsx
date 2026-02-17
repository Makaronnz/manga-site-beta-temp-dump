// src/app/series/[id]/[chap]/page.tsx
/**
 * INFO:
 * Reader page wrapper under /series/[id]/[chap].
 * - Fetches page URLs from our API: /api/chapter/detail?series=<id>&chap=<chap>.
 * - Optionally fetches canonical slug + mdId (for AutoSaveProgress). If missing, page still renders.
 * - No changes in UI — pairs with ChapterReaderClient above.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import ChapterReaderClient from "@/components/ChapterReaderClient";
import AutoSaveProgress from "@/components/AutoSaveProgress";
import { resolveSeries } from "@/lib/series-resolver";
import { getChapterDetails } from "@/lib/chapters-controller";

type SeriesDetails =
  | { slug?: string; mdId?: string }
  | { data?: { slug?: string; mdId?: string } };

export default async function ReadCanonicalUnderId(props: {
  params: Promise<{ id: string; chap: string }>;
}) {
  const params = await props.params;
  const { id, chap } = params;

  // A) Page list from controller
  const { pages, resolved, status } = await getChapterDetails(null, id, chap);

  if (status === 404 || !pages || pages.length === 0) {
    notFound();
  }

  const images = pages;
  const chapterId = resolved?.chapterId || "";

  // B) Optional canonical slug + mdId
  let canonicalSlug: string | undefined;
  let mdId: string | undefined;
  try {
    // Direct resolution (No fetch)
    const resolved = await resolveSeries(id);
    if (resolved) {
      canonicalSlug = resolved.slug;
      mdId = resolved.mdId;
    }
  } catch (e) { console.error("Create Page Resolve Error:", e); }

  if (canonicalSlug && canonicalSlug !== id) {
    redirect(`/series/${canonicalSlug}/${chap}`);
  }

  return (
    <>
      {mdId && chapterId ? (
        <AutoSaveProgress seriesId={mdId} chapterId={chapterId} />
      ) : null}
      <ChapterReaderClient seriesId={mdId || ""} chapterId={chapterId} images={images} />
    </>
  );
}
