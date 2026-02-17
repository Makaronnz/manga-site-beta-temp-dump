// src/app/search/page.tsx
import Link from "next/link";

type SeriesItem = { id: string; title: string; cover?: string | null; year?: number | null };

async function fetchResults(q: string): Promise<SeriesItem[]> {
  const sp = new URLSearchParams();
  if (q) sp.set("title", q);
  sp.set("limit", "200");
  sp.append("ratings", "safe");
  sp.append("ratings", "suggestive");
  sp.append("ratings", "erotica");
  sp.set("hasAvailableChapters", "true");

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const r = await fetch(`${base}/api/series/list?${sp.toString()}`, { cache: "no-store" });
  if (!r.ok) return [];
  const j = (await r.json()) as { items?: SeriesItem[] };
  return j.items ?? [];
}

export default async function SearchPage({
  searchParams,
}: {
  // important: promise-friendly
  searchParams?: Promise<{ q?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const items = await fetchResults(q);

  return (
    <div className="container mx-auto px-4 md:px-6 py-24">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Search Results</h1>
        <p className="text-sm opacity-80 mt-1">
          {q ? (
            <>
              Query: <span className="font-medium">&quot;{q}&quot;</span> • {items.length} result(s)
            </>
          ) : (
            "All series"
          )}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-sm opacity-80">No results found.</div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((m) => (
            <li
              key={m.id}
              className="border border-border rounded-md overflow-hidden bg-card hover:shadow-md transition-shadow"
            >
              <Link href={`/series/${m.id}`} className="flex gap-3 p-3">
                <div className="shrink-0 w-16 h-20 rounded-sm overflow-hidden border border-border/60">
                  {/* native img: Next/Image domain kısıtına takılmasın */}
                  <img
                    src={m.cover ?? "/placeholder-cover.png"}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[0.98rem] font-medium leading-tight line-clamp-2">{m.title}</div>
                  {m.year ? <div className="text-[0.75rem] opacity-70 mt-1">{m.year}</div> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
