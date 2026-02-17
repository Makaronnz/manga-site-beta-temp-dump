// src/app/series/[id]/chapter/[chapterId]/page.tsx
import { redirect, notFound } from "next/navigation";
import { resolveSeries } from "@/lib/series-resolver";
import { hydrateFromMangadex } from "@/lib/series-hydrator";

export const dynamic = "force-dynamic";

// Shorten a UUID to first 8 chars for URL
function short8(id?: string | null) {
  return (id || "").replace(/-/g, "").slice(0, 8);
}

export default async function LegacyReadRedirect(props: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const awaited = await props.params;
  const { id: mdId, chapterId } = awaited;

  // 1) Load chapter meta to extract chapter label, lang, group
  let cRes: Response;
  try {
    cRes = await fetch(`https://api.mangadex.org/chapter/${encodeURIComponent(chapterId)}?includes[]=scanlation_group&includes[]=manga`, {
      cache: "no-store",
      headers: { accept: "application/json", "user-agent": "MakaronComiks/1.0" },
    });
  } catch (e) {
    console.warn(`[LegacyReadRedirect] fetch failed for chapter ${chapterId}:`, e);
    notFound();
  }

  if (!cRes.ok) notFound();
  const cj = (await cRes.json()) as {
    data?: {
      id: string;
      attributes?: { chapter?: string | null; translatedLanguage?: string | null };
      relationships?: { id: string; type: string }[];
    };
  };
  const data = cj?.data;
  if (!data) notFound();

  const chapterLabel = data.attributes?.chapter || "oneshot";
  const lang = (data.attributes?.translatedLanguage || "en").toLowerCase();
  const groupId = data.relationships?.find((r) => r.type === "scanlation_group")?.id || "";
  const gShort = short8(groupId);

  // 2) Resolve our series slug for this MD manga id (hydrate on first touch)
  let series = await resolveSeries(mdId);
  if (!series) {
    try {
      series = await hydrateFromMangadex(mdId);
    } catch {
      notFound();
    }
  }
  const slug = series.slug;

  // 3) Build canonical chapter slug and redirect
  const chapSlug = `g-${gShort}-chapter-${encodeURIComponent(chapterLabel)}-${lang}`;
  redirect(`/series/${slug}/${chapSlug}`);
}
