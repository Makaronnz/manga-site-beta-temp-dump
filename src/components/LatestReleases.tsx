import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";

type LatestItem = {
  mangaId: string;
  title: string;
  chapterId: string;
  chapter: string | null;
  publishAt: string | null;
  cover: string | null;
};

async function fetchLatest(limit = 24): Promise<{ items: LatestItem[]; failed: boolean }> {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("host") ?? "localhost:3000";
    const res = await fetch(`${proto}://${host}/api/latest?limit=${limit}`, { cache: "no-store" });
    if (!res.ok) return { items: [], failed: true };
    const data = await res.json();
    return { items: (data?.items as LatestItem[]) ?? [], failed: false };
  } catch {
    return { items: [], failed: true };
  }
}

export default async function LatestReleases() {
  const { items, failed } = await fetchLatest(24);

  return (
    <section id="latest" className="container mx-auto px-4 md:px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Latest releases</h2>
        <Link
          href="/browse"
          className="inline-flex h-9 items-center rounded-md border border-white/15 px-3 text-sm hover:bg-white/10"
        >
          See all →
        </Link>
      </div>

      {failed ? (
        <div className="rounded-xl border border-white/10 p-4 text-sm opacity-80">
          Couldn’t load latest chapters right now. Please try again in a moment.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {items.map((it) => (
            <Link
              key={`${it.mangaId}-${it.chapterId}`}
              href={`/series/${it.mangaId}/chapter/${it.chapterId}`}
              className="group relative block overflow-hidden rounded-xl border border-white/10 bg-neutral-950"
            >
              <div className="relative aspect-[2/3]">
                {it.cover ? (
                  <Image
                    src={it.cover}
                    alt={`${it.title} – cover`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 16vw, 300px"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-neutral-800 text-neutral-400">
                    No Image
                  </div>
                )}
              </div>

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
                <h3 className="truncate text-sm font-semibold" title={it.title}>
                  {it.title}
                </h3>
                <p className="mt-1 text-xs opacity-90">
                  {it.chapter ? `Chapter ${it.chapter}` : "—"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
