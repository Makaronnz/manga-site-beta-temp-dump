export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSeriesChapters } from "@/lib/chapters-controller";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const rawIdOrSlug = (searchParams.get("id") || searchParams.get("slug") || "").trim();
  const byChapterId = searchParams.get("byChapterId") || undefined;
  const group = searchParams.get("group") || undefined;
  const lang = searchParams.get("lang") || undefined;
  const limitStr = searchParams.get("limit");
  const limit = limitStr ? Number(limitStr) : undefined;

  // If using byChapterId, rawIdOrSlug might be empty/ignored in list path, but we pass options anyway
  // The controller handles the logic: strictly speaking `byChapterId` path doesn't need ID, passing "" is fine.

  const result = await getSeriesChapters(rawIdOrSlug, {
    byChapterId,
    group,
    lang,
    limit,
  });

  return NextResponse.json(result);
}
