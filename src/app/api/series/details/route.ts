// src/app/api/series/details/route.ts
/**
 * info:
 * Robust series-details endpoint.
 * Uses shared logic in @/lib/series-controller.ts
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSeriesDetails } from "@/lib/series-controller";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idParam = (searchParams.get("id") || "").trim();
  const slugParam = (searchParams.get("slug") || "").trim();

  const result = await getSeriesDetails(idParam, slugParam);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: result.status });
}
