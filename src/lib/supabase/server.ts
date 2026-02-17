// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server Component safe client (RSC):
 * - Reads cookies (await cookies())
 * - DOES NOT write cookies (set/remove are NOOP)
 *   Next.js 15: cookie writes are allowed only in Route Handlers / Server Actions.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies(); // Next 15: must await

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // ❌ Don’t write cookies in RSC
        set() { /* no-op in Server Components */ },
        remove() { /* no-op in Server Components */ },
      },
    }
  );
}
