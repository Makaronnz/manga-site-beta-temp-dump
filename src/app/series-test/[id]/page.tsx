// src/app/series-test/[id]/page.tsx
// Simplified test page to debug series resolution

import { notFound } from "next/navigation";
import { resolveSeries } from "@/lib/series-resolver";
import { supabaseFromCookiesReadOnly } from "@/lib/supabase-route";

export const dynamic = "force-dynamic";

export default async function SeriesTestPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const raw = params.id.trim();

    // Test 1: Direct Supabase query
    let directResult: any = null;
    let directError: string | null = null;
    try {
        const db = await supabaseFromCookiesReadOnly();
        const { data, error } = await db
            .from("series")
            .select("id, slug, title")
            .eq("slug", raw.toLowerCase())
            .maybeSingle();
        directResult = data;
        directError = error?.message || null;
    } catch (e: any) {
        directError = e.message;
    }

    // Test 2: resolveSeries
    let resolveResult: any = null;
    let resolveError: string | null = null;
    try {
        resolveResult = await resolveSeries(raw);
    } catch (e: any) {
        resolveError = e.message;
    }

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-2xl font-bold mb-4">Series Resolution Debug</h1>
            <p className="mb-2"><strong>Input:</strong> {raw}</p>

            <div className="mb-4 p-4 bg-gray-100 rounded">
                <h2 className="font-semibold mb-2">Direct Supabase Query:</h2>
                <pre className="text-xs overflow-auto">
                    {JSON.stringify({ result: directResult, error: directError }, null, 2)}
                </pre>
            </div>

            <div className="p-4 bg-gray-100 rounded">
                <h2 className="font-semibold mb-2">resolveSeries Result:</h2>
                <pre className="text-xs overflow-auto">
                    {JSON.stringify({ result: resolveResult, error: resolveError }, null, 2)}
                </pre>
            </div>
        </div>
    );
}
