// src/lib/supabase-route.ts
// Next.js 15: cookies() is async — always await before use.

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Service role env adlarının farklı projelerde değişebilmesi ihtimaline karşı birkaç isim deniyoruz:
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE ||
  "";

/**
 * Route Handlers / Server Actions için R/W Supabase client (kullanıcı oturumu ile).
 */
export async function supabaseFromCookies(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

/**
 * Route Handlers / Server Components için read-only Supabase client (cookie yazmaz).
 */
export async function supabaseFromCookiesReadOnly(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // RSC içinde cookie yazmak yasak → no-op
      set() {},
      remove() {},
    },
  });
}

/**
 * Service role (admin) client — RLS’i bypass eder. Sadece server’da kullan.
 * Çevrede SERVICE ROLE yoksa null döner; arayan fallback yapmalıdır.
 */
export function supabaseService(): SupabaseClient | null {
  if (!SUPABASE_SERVICE_ROLE_KEY) return null;
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-mc-role": "service" } },
  });
}
