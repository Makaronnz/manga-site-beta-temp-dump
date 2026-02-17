// src/app/read/[chapterId]/page.tsx
import { notFound } from "next/navigation";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signProxyUrl } from "@/lib/proxy-sign";

type Params = { chapterId: string };

export default async function ReaderPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { chapterId } = await params;
  const id = Number(chapterId);
  if (Number.isNaN(id)) notFound();

  const db = await createSupabaseServerClient(); // ← await

  const { data: ch, error: chErr } = await db
    .from("chapters")
    .select("id, number, series_id")
    .eq("id", id)
    .maybeSingle();

  if (chErr) throw chErr;
  if (!ch) notFound();

  const { data: pages, error: pgErr } = await db
    .from("pages")
    .select("id, page_number, remote_url, width, height")
    .eq("chapter_id", id)
    .order("page_number");

  if (pgErr) throw pgErr;

  const proxiedPages =
    pages && pages.length
      ? await Promise.all(
          pages.map(async (p) => ({
            ...p,
            proxied: await signProxyUrl(p.remote_url),
          }))
        )
      : [];

  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="text-xl font-semibold mb-4">Chapter {ch.number}</h1>

      {proxiedPages.length === 0 ? (
        <div className="opacity-70">No pages found for this chapter.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {proxiedPages.map((p) => (
            <div key={p.id} className="w-full">
              <Image
                src={p.proxied}
                alt={`Page ${p.page_number}`}
                width={p.width || 1200}
                height={p.height || 1800}
                sizes="100vw"
                style={{ width: "100%", height: "auto" }}
                priority={p.page_number <= 2}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
