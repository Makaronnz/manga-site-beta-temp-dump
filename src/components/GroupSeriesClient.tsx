// src/components/GroupSeriesClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";

type MDList<T> = { result: "ok"; data: T[]; total?: number; limit?: number; offset?: number };
type MDRel = { id: string; type: string; attributes?: any };
type MDGroup = { id: string; attributes: { name: string } };
type MDChapter = {
  id: string;
  attributes: { chapter?: string; translatedLanguage?: string; publishAt?: string | null };
  relationships: MDRel[];
};
type MDManga = {
  id: string;
  attributes: { title: Record<string, string> };
  relationships: MDRel[];
};

type GridItem = {
  mangaId: string;      // MD UUID
  title: string;
  coverUrl: string | null;
  lastChap: string | null;
  lastAt: string | null;
};

function toNum(v?: string) {
  return Number((v || "").replace(/[^0-9.]/g, ""));
}

const PAGE = 100;
const MAX_PAGES = 5; // güvenli üst sınır (500 chapter)

export default function GroupSeriesClient({ slug }: { slug: string }) {
  const { t } = useLang();
  const [lang, setLang] = useState<string>("en");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>(slug);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GridItem[]>([]);
  const [q, setQ] = useState("");
  const [slugMap, setSlugMap] = useState<Record<string, string>>({}); // ✅ MD id → slug

  // 1) Grubu ada göre bul
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(
          `https://api.mangadex.org/group?limit=5&name=${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        );
        const j: MDList<MDGroup> = await r.json();
        const g = j.data.find((x) => x.attributes?.name?.toLowerCase() === slug.toLowerCase()) || j.data[0];
        if (!alive) return;
        if (g) {
          setGroupId(g.id);
          setGroupName(g.attributes?.name || slug);
        } else {
          setGroupId(null);
          setGroupName(slug);
        }
      } catch {
        setGroupId(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  // 2) Chapter’ları çek → manga bazında grupla → manga detay + kapakları al
  useEffect(() => {
    if (!groupId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // Chapter’ları sayfa sayfa çek
        let offset = 0;
        const all: MDChapter[] = [];
        for (let i = 0; i < MAX_PAGES; i++) {
          const url =
            `https://api.mangadex.org/chapter?limit=${PAGE}` +
            `&groups[]=${groupId}` +
            (lang ? `&translatedLanguage[]=${encodeURIComponent(lang)}` : "") +
            `&order[chapter]=asc&includes[]=manga&offset=${offset}`;
          const r = await fetch(url, { cache: "no-store" });
          const j: MDList<MDChapter> = await r.json();
          all.push(...(j.data || []));
          if (!j.data || j.data.length < PAGE) break;
          offset += PAGE;
        }

        // Manga ID → son chapter bilgisi
        const byManga = new Map<
          string,
          { lastNum: number; lastChap: string | null; lastAt: string | null }
        >();
        const mangaIds = new Set<string>();
        for (const ch of all) {
          const manga = ch.relationships.find((r) => r.type === "manga");
          if (!manga) continue;
          mangaIds.add(manga.id);
          const n = toNum(ch.attributes?.chapter || "");
          const prev = byManga.get(manga.id);
          if (!prev || n > prev.lastNum) {
            byManga.set(manga.id, {
              lastNum: n,
              lastChap: ch.attributes?.chapter || null,
              lastAt: ch.attributes?.publishAt || null,
            });
          }
        }

        // Manga detaylarını toplu çek (kapaklarla birlikte)
        const ids = Array.from(mangaIds);
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

        const details: MDManga[] = [];
        for (const chunk of chunks) {
          const url =
            `https://api.mangadex.org/manga?limit=${chunk.length}` +
            chunk.map((id) => `&ids[]=${id}`).join("") +
            `&includes[]=cover_art`;
          const r = await fetch(url, { cache: "no-store" });
          const j: MDList<MDManga> = await r.json();
          details.push(...(j.data || []));
        }

        const grid: GridItem[] = details.map((m) => {
          const titleObj = m.attributes?.title || {};
          const title =
            titleObj?.en ||
            (Object.values(titleObj)[0] as string | undefined) ||
            t.common.untitled;
          const coverRel = m.relationships?.find((r) => r.type === "cover_art");
          const file = (coverRel as any)?.attributes?.fileName as string | undefined;
          const coverUrl = file ? `https://uploads.mangadex.org/covers/${m.id}/${file}.256.jpg` : null;
          const last = byManga.get(m.id);
          return {
            mangaId: m.id,
            title: String(title),
            coverUrl,
            lastChap: last?.lastChap || null,
            lastAt: last?.lastAt || null,
          };
        });

        if (!alive) return;

        // Show content immediately with UUIDs
        grid.sort((a, b) => a.title.localeCompare(b.title));
        setItems(grid);
        setLoading(false);

        // Fetch slugs in background (non-blocking) - chunked to avoid URL limits
        if (grid.length) {
          const allIds = grid.map(g => g.mangaId);
          // Process in chunks of 50 to avoid massive URL or timeouts
          const chunks = [];
          for (let i = 0; i < allIds.length; i += 50) chunks.push(allIds.slice(i, i + 50));

          // Run chunks in parallel or sequence, but detached from UI blocking
          (async () => {
            for (const chunk of chunks) {
              if (!alive) break;
              const idsCsv = chunk.join(",");
              try {
                const mRes = await fetch(`/api/series/slug-map?ids=${encodeURIComponent(idsCsv)}&hydrate=1`, { cache: "no-store" });
                if (mRes.ok && alive) {
                  const j = await mRes.json() as { map?: Record<string, string> };
                  setSlugMap(prev => ({ ...prev, ...(j.map || {}) }));
                }
              } catch (e) {
                console.error("Slug hydration error", e);
              }
            }
          })();
        }
      } catch (e) {
        console.error("Group fetch error", e);
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [groupId, lang]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return !ql ? items : items.filter((it) => it.title.toLowerCase().includes(ql));
  }, [items, q]);

  const hrefFor = (mdId: string) => `/series/${slugMap[mdId] ?? mdId}`;

  return (
    <div className="container mx-auto px-4 md:px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{groupName}</h1>
          <p className="opacity-70 text-sm">
            Series translated by this group ({filtered.length}{loading ? "…" : ""})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Search series…"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="text-sm opacity-70">Lang</label>
          <select
            className="h-9 rounded-md border bg-background text-sm"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            title="Translated language"
          >
            {["en", "tr", "es", "fr", "de", "ru", "pt-br", "id", "vi", "ar", "it"].map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="opacity-70">{t.common.loading}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filtered.map((it) => (
            <div key={it.mangaId} className="rounded-xl border overflow-hidden bg-background">
              <Link href={hrefFor(it.mangaId)} title={it.title} className="block">
                {it.coverUrl ? (
                  <img
                    src={it.coverUrl}
                    alt={it.title}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    className="w-full h-56 object-cover"
                  />
                ) : (
                  <div className="w-full h-56 grid place-items-center text-sm opacity-60">No cover</div>
                )}
              </Link>
              <div className="p-3">
                <Link href={hrefFor(it.mangaId)} className="font-medium hover:underline">
                  {it.title}
                </Link>
                <div className="text-xs opacity-70 mt-1">
                  {it.lastChap ? `Last: ${it.lastChap}` : "–"}{" "}
                  {it.lastAt ? ` • ${new Date(it.lastAt).toLocaleDateString()}` : ""}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full opacity-70">{t.common.noResultsFilter}</div>
          )}
        </div>
      )}
    </div>
  );
}
