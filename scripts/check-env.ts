
// scripts/check-env.ts
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
    console.log("🔍 Checking Environment...");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.error("❌ Supabase vars missing.");
        process.exit(1);
    } else {
        console.log("✅ Supabase vars found.");
    }

    const sb = createClient(url, key);

    // Test connection
    const { data, error } = await sb.from("user_profiles").select("count").limit(1);
    if (error) {
        if (error.code === '42P01') {
            console.error("❌ Table 'user_profiles' does not exist. Did you run schema.sql?");
        } else {
            console.error("❌ Supabase connection failed:", error.message);
        }
    } else {
        console.log("✅ Supabase connection & 'user_profiles' table OK.");
    }

    // Test MangaDex
    console.log("🔍 Testing MangaDex API...");
    try {
        const start = Date.now();
        const r = await fetch("https://api.mangadex.org/manga?limit=1");
        const ms = Date.now() - start;
        if (r.ok) console.log(`✅ MangaDex API reachable (${ms}ms)`);
        else console.warn(`⚠️ MangaDex returned ${r.status}`);
    } catch (e) {
        console.error("❌ MangaDex unreachable:", e);
    }
}

main().catch(console.error);
