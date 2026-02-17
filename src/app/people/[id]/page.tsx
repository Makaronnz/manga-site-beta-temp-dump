// src/app/people/[id]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Person = { id: string; attributes?: { name?: string } };
type MangaItem = { id: string; attributes?: { title?: Record<string, string | undefined> } };
type CoverItem = {
  attributes?: { fileName?: string };
  relationships?: { id: string; type: string }[];
};

function pickTitle(t?: Record<string, string | undefined>) {
  if (!t) return "Untitled";
  return t["en"] || t["ja-ro"] || t["ja"] || t["ko"] || t["zh-hk"] || t["zh"] || Object.values(t)[0] || "Untitled";
}

export default async function PersonPage(props: { params: Promise<{ id: string }> }) {
  const awaited = await props.params;

  // 1) kişi
  const pRes = await fetch(`https://api.mangadex.org/author/${awaited.id}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!pRes.ok) notFound();
  const pj = (await pRes.json()) as { data?: Person };
  const person = pj.data;
  if (!person) notFound();
  const name = person.attributes?.name || "Unknown";

  // 2) bu kişinin eserleri (author VEYA artist)
  const mUrl = new URL("https://api.mangadex.org/manga");
  mUrl.searchParams.set("limit", "50");
  mUrl.searchParams.append("authors[]", awaited.id);
  mUrl.searchParams.append("artists[]", awaited.id);
  const mRes = await fetch(mUrl.toString(), { headers: { accept: "application/json" }, cache: "no-store" });
  const mj = (await mRes.json()) as { data?: MangaItem[] };
  const mangas = mj.data ?? [];
  const ids = mangas.map((m) => m.id);

  // 3) kapaklar (bulk)
  const coverMap = new Map<string, string>();
  if (ids.length) {
    const cRes = await fetch(
      `https://api.mangadex.org/cover?limit=100&${ids.map((id) => `manga[]=${id}`).join("&")}`,
      { headers: { accept: "application/json" }, cache: "no-store" }
    );
    if (cRes.ok) {
      const cj = (await cRes.json()) as { data?: CoverItem[] };
      for (const c of cj.data ?? []) {
        const mid = c.relationships?.find((r) => r.type === "manga")?.id;
        const fn = c.attributes?.fileName;
        if (mid && fn && !coverMap.has(mid)) {
          coverMap.set(mid, `https://uploads.mangadex.org/covers/${mid}/${fn}.256.jpg`);
        }
      }
    }
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8">
      <h1 className="text-2xl md:text-3xl font-semibold mb-1">{name}</h1>
      <p className="opacity-70 mb-4">Works by this person (author/artist)</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-6">
        {mangas.map((m) => (
          <Link key={m.id} href={`/series/${m.id}`} className="group block">
            <div className="relative rounded-xl overflow-hidden border bg-muted/10 w-full pb-[133%]">
              {coverMap.get(m.id) ? (
                <Image
                  src={coverMap.get(m.id)!}
                  alt={pickTitle(m.attributes?.title)}
                  fill
                  sizes="(max-width: 640px) 170px, (max-width: 768px) 200px, 220px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-xs opacity-70">No Image</div>
              )}
            </div>
            <div className="mt-2 text-sm line-clamp-2">{pickTitle(m.attributes?.title)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
