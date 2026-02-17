// src/app/api/debug/resolve-series/route.ts
// DEBUG ONLY - remove after fixing

import { NextResponse } from "next/server";
import { resolveSeries } from "@/lib/series-resolver";
import { supabaseFromCookiesReadOnly } from "@/lib/supabase-route";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug") || "";

    try {
        // Test 1: Direct DB query
        const db = await supabaseFromCookiesReadOnly();
        const { data: directQuery, error: dbError } = await db
            .from("series")
            .select("id, slug, title")
            .eq("slug", slug.toLowerCase())
            .maybeSingle();

        // Test 2: resolveSeries
        const resolved = await resolveSeries(slug);

        return NextResponse.json({
            input: slug,
            inputLowercase: slug.toLowerCase(),
            directQuery: directQuery || null,
            dbError: dbError?.message || null,
            resolvedSeries: resolved,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
