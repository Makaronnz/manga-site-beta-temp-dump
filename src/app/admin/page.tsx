// src/app/admin/page.tsx
import React from "react";
import { supabaseFromCookiesReadOnly } from "@/lib/supabase-route";
import AdminActions from "./_components/AdminActions";
import { headers as nextHeaders, cookies as nextCookies } from "next/headers";

export const dynamic = "force-dynamic";

type DashboardData = {
  pendingGroups: { id: number; name: string; slug: string; approved: boolean; created_at: string }[];
  pendingUploads: {
    id: string;
    status: string;
    created_at: string;
    group: { id: number; name: string; slug: string };
    series: { id: number; title: string; slug: string | null };
    chapter: { number: number; title: string | null; lang: string | null };
    storage_prefix: string;
    preview_pages: string[];
  }[];
};

async function buildBaseUrl() {
  const hdrs = await nextHeaders(); // MUST await in Next 15
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function buildCookieHeader() {
  const store = await nextCookies(); // MUST await in Next 15
  const parts = store.getAll().map((c) => `${c.name}=${c.value}`);
  return parts.join("; ");
}

async function fetchDashboard(): Promise<DashboardData> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || (await buildBaseUrl());
  const cookieHeader = await buildCookieHeader();

  // Server'da absolute URL ve cookie forward şart
  const res = await fetch(`${base}/api/admin/dashboard`, {
    cache: "no-store",
    headers: { cookie: cookieHeader },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load admin dashboard (${res.status}): ${text}`);
  }
  return res.json();
}

export default async function AdminPage() {
  // Auth check (Server Component → READ-ONLY client)
  const supabase = await supabaseFromCookiesReadOnly();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id || "";
  const admins = (process.env.MC_ADMIN_UIDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const isAdmin = uid && admins.includes(uid);

  if (!isAdmin) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-4">Forbidden.</p>
      </main>
    );
  }

  const data = await fetchDashboard();

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-8">
      <h1 className="text-3xl font-bold">MakaronComiks — Admin Dashboard</h1>

      {/* Pending Groups */}
      <section>
        <h2 className="text-xl font-semibold">Pending Groups</h2>
        <div className="mt-4 grid gap-4">
          {data.pendingGroups.length === 0 && <div className="opacity-60">No pending groups.</div>}
          {data.pendingGroups.map((g) => (
            <div key={g.id} className="border rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{g.name}</div>
                <div className="text-sm opacity-70">
                  ID: {g.id} · Created: {new Date(g.created_at).toLocaleString()}
                </div>
              </div>
              <AdminActions.GroupActions groupId={g.id} />
            </div>
          ))}
        </div>
      </section>

      {/* Pending Uploads */}
      <section>
        <h2 className="text-xl font-semibold">Pending Uploads</h2>
        <div className="mt-4 grid gap-6">
          {data.pendingUploads.length === 0 && <div className="opacity-60">No pending uploads.</div>}
          {data.pendingUploads.map((u) => (
            <div key={u.id} className="border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">
                    {u.series.title || "Untitled series"} — Ch.{String(u.chapter.number)}
                    {u.chapter.title ? `: ${u.chapter.title}` : ""} {u.chapter.lang ? `(${u.chapter.lang})` : ""}
                  </div>
                  <div className="text-sm opacity-70">
                    Group: {u.group.name} (ID: {u.group.id}) · Upload ID: {u.id} · Status: {u.status} · Created:{" "}
                    {new Date(u.created_at).toLocaleString()}
                  </div>
                </div>
                <AdminActions.UploadActions groupId={u.group.id} uploadId={u.id} />
              </div>

              {u.preview_pages.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
                  {u.preview_pages.map((src, i) => (
                    <div key={i} className="rounded-lg overflow-hidden border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={`page-${i + 1}`} src={src} className="w-full h-40 object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
