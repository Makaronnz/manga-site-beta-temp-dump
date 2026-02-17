// src/app/profile/page.tsx
/**
 * info:
 * Personal profile redirector (single-route model).
 * - If signed in and has a username → redirect to /u/[username]
 * - If signed in but no username → redirect to /settings (to set handle)
 * - If not signed in → redirect to home
 * Uses the server-side Supabase client so auth comes from cookies (reliable).
 */

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProfileIndexPage() {
  const supabase = await createSupabaseServerClient();

  // 1) Viewer (from cookies)
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    redirect("/"); // or "/login" if you prefer
  }

  // 2) Resolve username
  const { data: prof, error } = await supabase
    .from("user_profiles")
    .select("username")
    .eq("auth_uid", auth.user.id)
    .maybeSingle();

  if (error) {
    // Fail safe
    redirect("/");
  }

  // 3) Route decision
  if (prof?.username) {
    redirect(`/u/${encodeURIComponent(prof.username)}`);
  } else {
    redirect("/settings"); // no username yet → let them edit profile
  }
}
