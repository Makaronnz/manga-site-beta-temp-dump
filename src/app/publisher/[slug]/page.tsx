// src/app/publisher/[slug]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Item = { id: string; attributes?: { title?: Record<string, string | undefined> } };
type CoverItem = { attributes?: { fileName?: string }; relationships?: { id: string; type: string }[] };

function pickTitle(t?: Record<string, string | undefined>) {
  if (!t) return "Untitled";
  return t["en"] || t["ja-ro"] || t["ja"] || t["ko"] || t["zh-hk"] || t["zh"] || Object.values(t)[0] || "Untitled";
}

const PUBLISHERS: Record<
  string,
  { name: string; langFallback: string | null; hostHints: RegExp[] }
> = {
  "naver": { name: "Naver", langFallback: "ko", hostHints: [/naver\.com/, /webtoon\.naver\.com/] },
  "line-webtoon": { name: "LINE Webtoon", langFallback: "ko", hostHints: [/webtoons\.com/] },
  "kakao": { name: "KakaoPage", langFallback: "ko", hostHints: [/kakao|kakaopage/i] },
  "bilibili": { name: "Bilibili", langFallback: "zh", hostHints: [/bilibili/i] },
  "moon-phase": { name: "Moon Phase", langFallback: "ja", hostHints: [/moonphase|moe|moa/i] },
  "jp-publisher": { name: "JP Publisher", langFallback: "ja", hostHints: [/bookwalker|cdjapan|ebookjapan|comic-days/i] },
};

export default async function PublisherPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const awaited = await props.params;

  const meta = PUBLISHERS[awaited.slug];
  if (!meta) notFound();

  // 1) Dil bazlı bir havuz çek (son yüklenen popülerlerden ~60)
  const url = new URL("https://api.mangadex.org/manga");
  url.searchParams.set("limit", "60");
  if (meta.langFallback) url.searchParams.append("originalLanguage[]", meta.langFallback);
  url.searchParams.set("order[latestUploadedChapter]", "desc");

  const mRes = await fetch(url.toString(), { headers: { accept: "application/json" }, cache: "no-store" });
  const mj = (await mRes.json()) as { data?: Item[] };
  const pool = mj.data ?? [];
  const ids = pool.map((m) => m.id);

  // 2) Kapaklar
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

  // 3) Domain eşleşmesi için detaylara bakıp RAW/ENG link host’larını kontrol et
  //    Çok ağır olmasın diye ilk 40 öğeyi kontrol edelim.
  const consider = pool.slice(0, 40);
  const matches: Item[] = [];
  for (const m of consider) {
    try {
      const r = await fetch(`https://api.mangadex.org/manga/${m.id}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!r.ok) continue;
      const j = (await r.json()) as {
        data?: { attributes?: { links?: Record<string, string | undefined> } };
      };
      const links = j?.data?.attributes?.links || {};
      const urls = [links["raw"], links["engtl"]].filter(Boolean) as string[];
      const ok = urls.some((u) => {
        try {
          const h = new URL(u).hostname.toLowerCase();
          return meta.hostHints.some((re) => re.test(h));
        } catch {
          return false;
        }
      });
      if (ok) matches.push(m);
    } catch {
      // yut
    }
  }

  const list = matches.length ? matches : pool;

  return (
    <div className="container mx-auto px-4 md:px-6 py-8">
      <h1 className="text-2xl md:text-3xl font-semibold mb-1">{meta.name}</h1>
      <p className="opacity-70 mb-4">
        {matches.length
          ? "Matched by RAW/ENG link domain."
          : "Approximate list by original language (publisher filter not provided by MangaDex)."}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-6">
        {list.map((m) => (
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
