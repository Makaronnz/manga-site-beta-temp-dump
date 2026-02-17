"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import AvatarImg from "@/components/AvatarImg";
import { useLang } from "@/components/LanguageProvider";

/* ───────────────── helpers ───────────────── */
function normalize(s: string) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = tmp;
    }
  }
  return dp[n];
}

/* ───────────────── search box ─────────────── */
type SeriesItem = { id: string; title: string; cover?: string | null; year?: number | null };

function SearchBox({
  autoFocus,
  onDone,
  placeholder, // optionally override
  size = "md",
}: {
  autoFocus?: boolean;
  onDone?: () => void;
  placeholder?: string;
  size?: "md" | "lg";
}) {
  const { t } = useLang();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SeriesItem[]>([]);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setItems([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const sp = new URLSearchParams();
        sp.set("limit", "30");
        sp.set("title", term);
        sp.append("ratings", "safe");
        sp.append("ratings", "suggestive");
        sp.append("ratings", "erotica");
        sp.set("hasAvailableChapters", "true");
        const r = await fetch(`/api/series/list?${sp.toString()}`, { cache: "no-store" });
        const j = (await r.json()) as { items?: SeriesItem[] };
        const list = (j.items ?? []).slice(0, 30);
        const nq = normalize(term);

        const scored = list
          .map((it) => {
            const nt = normalize(it.title || "");
            let score = 1;
            if (nt === nq) score = 0;
            else {
              const idx = nt.indexOf(nq);
              if (idx === 0) score = 0.2 + Math.min(0.3, Math.abs(nt.length - nq.length) / 100);
              else if (idx > 0) score = 0.4 + Math.min(0.2, idx / 100);
              else {
                const dist = levenshtein(nt, nq);
                const ratio = dist / Math.max(1, Math.max(nt.length, nq.length));
                score = 0.6 + Math.min(0.4, ratio);
              }
            }
            return { it, score };
          })
          .sort((a, b) => a.score - b.score)
          .slice(0, 30)
          .map((x) => x.it);

        setItems(scored); setActive(0); setOpen(scored.length > 0);
      } catch {
        setItems([]); setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current
      .querySelector<HTMLButtonElement>(`button[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function goToSeries(id: string) {
    router.push(`/series/${id}`); setOpen(false); onDone?.();
  }
  function goToSearchPage() {
    const term = q.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : `/search`);
    setOpen(false); onDone?.();
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(items.length > 0); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "PageDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 6)); }
    else if (e.key === "PageUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 6)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(items.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); goToSearchPage(); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  const inputSize = size === "lg" ? "h-12 text-[1.05rem]" : "h-11 text-[0.98rem]";

  return (
    <div className="relative w-full" ref={wrapRef}>
      <div className="flex items-center rounded-md border border-border overflow-hidden bg-background">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder || t.search.placeholder}
          autoFocus={autoFocus}
          className={`${inputSize} w-full bg-transparent px-3 outline-none`}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="search-suggest"
        />
        <button
          type="button"
          onClick={goToSearchPage}
          className={`${size === "lg" ? "h-12 px-4" : "h-11 px-3"} border-l border-border hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer`}
          aria-label="Search"
        >
          <i className={`fa-solid ${loading ? "fa-circle-notch fa-spin" : "fa-magnifying-glass"}`} />
        </button>
      </div>

      {open && items.length > 0 && (
        <ul
          id="search-suggest"
          ref={listRef}
          className="absolute z-[70] mt-1 w-[calc(120%+40px)] -ml-5 rounded-md border border-border bg-background shadow-xl max-h-130 overflow-y-auto"
          role="listbox"
        >
          {items.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                data-index={i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goToSeries(m.id)}
                onMouseEnter={() => setActive(i)}
                className={[
                  "w-full text-left px-3 py-2 flex items-center gap-3",
                  "cursor-pointer transition-colors",
                  i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent",
                ].join(" ")}
                role="option"
                aria-selected={i === active}
                title={m.title}
              >
                <div className="shrink-0 w-15 h-18 rounded-sm overflow-hidden border border-border/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.cover ?? "/placeholder-cover.png"}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[0.97rem] leading-tight line-clamp-1">{m.title}</div>
                  {m.year ? <div className="text-[0.72rem] opacity-70">{m.year}</div> : null}
                </div>
              </button>
            </li>
          ))}
          <li className="border-t border-border sticky bottom-0 bg-background">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={goToSearchPage}
              className="w-full text-left px-3 py-2 text-[12.5px] opacity-90 hover:bg-accent cursor-pointer transition-colors"
            >
              {t.search.seeAll}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

/* ───────────────── header ───────────────── */

export default function Header() {
  const { t } = useLang();
  const pathname = usePathname();

  const navItems = [
    { name: t.nav.home, href: "/", icon: "fa-solid fa-house", isActive: (p: string) => p === "/" },
    { name: t.nav.popular, href: "/popular", icon: "fa-solid fa-fire", isActive: (p: string) => p.startsWith("/popular") },
    { name: t.nav.settings, href: "/settings", icon: "fa-solid fa-gear", isActive: (p: string) => p.startsWith("/settings") },
    { name: t.nav.about, href: "/about", icon: "fa-regular fa-circle-question", isActive: (p: string) => p.startsWith("/about") },
  ];

  // current user (for avatar)
  const [me, setMe] = useState<{ username?: string; avatarUrl?: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const u = j?.user;
        if (u && typeof u.id === "string" && u.id !== "guest") {
          if (!cancelled) setMe({ username: u.username, avatarUrl: u.avatarUrl || null });
        } else {
          if (!cancelled) setMe(null);
        }
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // lock scroll when overlays open
  useEffect(() => {
    const any = menuOpen || searchOpen;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    if (any) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [menuOpen, searchOpen]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenuOpen(false); setSearchOpen(false); } };
    if (menuOpen || searchOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, searchOpen]);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-sm",
        isScrolled ? "bg-background/90 border-b border-border shadow-md py-2" : "bg-background/70 py-3",
      ].join(" ")}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between gap-3">
        {/* brand */}
        <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="MakaronComiks Home">
          <Image
            src="/images/logo.png"
            alt="MakaronComiks logo"
            width={32}
            height={32}
            className="w-7 h-7 md:w-8 md:h-8 rounded-sm object-contain"
            priority
          />
          <span className="text-xl font-bold tracking-tight">MakaronComiks</span>
        </Link>

        {/* desktop nav */}
        <nav className="hidden md:flex items-center gap-2">
          {navItems.map((it) => {
            const active = it.isActive ? it.isActive(pathname) : pathname.startsWith(it.href);
            return (
              <Link
                key={it.name}
                href={it.href}
                className={[
                  "group inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/50 text-accent-foreground border border-border"
                    : "bg-background hover:bg-accent hover:text-accent-foreground border border-transparent",
                ].join(" ")}
              >
                {it.icon && <i className={it.icon} aria-hidden="true" />}
                <span>{it.name}</span>
              </Link>
            );
          })}

          {/* desktop search */}
          <div className="ml-2 hidden lg:block w-72">
            <SearchBox onDone={() => { /* noop */ }} placeholder={t.search.placeholder} />
          </div>

          {/* avatar (desktop) */}
          {me ? (
            <Link
              href="/profile"
              className="ml-2 hidden lg:inline-flex items-center gap-2 rounded-full p-1 cursor-pointer hover:bg-accent border border-border"
              title={t.nav.profile}
              aria-label={t.nav.profile}
            >
              <div className="relative w-8 h-8 rounded-full overflow-hidden">
                <AvatarImg src={me.avatarUrl} nameHint={me.username} size={32} />
              </div>
              <span className="hidden xl:inline text-sm">{me.username ?? t.nav.profile}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="ml-2 hidden lg:inline-flex h-10 items-center gap-2 rounded-md border border-border hover:bg-accent px-3"
              title={t.nav.login}
            >
              <i className="fa-regular fa-user" aria-hidden="true" />
              <span>{t.nav.login}</span>
            </Link>
          )}
        </nav>

        {/* md…lg right */}
        <div className="hidden md:flex lg:hidden items-center gap-2">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-accent cursor-pointer"
            onClick={() => setSearchOpen(true)}
            aria-label="Open search"
            type="button"
          >
            <i className="fa-solid fa-magnifying-glass" />
          </button>

          {me ? (
            <Link
              href="/profile"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-accent cursor-pointer overflow-hidden"
              aria-label="Open profile"
              title={t.nav.profile}
            >
              <AvatarImg src={me.avatarUrl} nameHint={me.username} size={40} />
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-accent cursor-pointer"
              aria-label="Open login"
              title={t.nav.login}
            >
              <i className="fa-regular fa-user" />
            </Link>
          )}
        </div>

        {/* mobile hamburger */}
        <button
          type="button"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-accent cursor-pointer"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <i className="fa-solid fa-bars" />
        </button>
      </div>

      {/* mobile sheet */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-background border-l border-border shadow-xl flex flex-col">
            <div className="h-14 flex items-center justify-between px-4">
              <span className="font-semibold">MakaronComiks</span>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-accent cursor-pointer"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                type="button"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="px-4 pb-3">
              <SearchBox onDone={() => setMenuOpen(false)} placeholder={t.search.placeholder} size="md" />
            </div>

            <nav className="px-2 py-2 flex-1 overflow-y-auto">
              {navItems.map((it) => {
                const active = it.isActive ? it.isActive(location.pathname) : location.pathname.startsWith(it.href);
                return (
                  <Link
                    key={it.name}
                    href={it.href}
                    className={[
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                      "cursor-pointer",
                      active ? "bg-accent/50 text-accent-foreground" : "hover:bg-accent text-foreground/90",
                    ].join(" ")}
                    onClick={() => setMenuOpen(false)}
                  >
                    {it.icon && <i className={it.icon} aria-hidden="true" />}
                    <span>{it.name}</span>
                  </Link>
                );
              })}

              {me ? (
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 h-10 rounded-md border border-border text-sm hover:bg-accent cursor-pointer"
                  title={t.nav.profile}
                >
                  <span className="relative w-6 h-6 rounded-full overflow-hidden">
                    <AvatarImg src={me.avatarUrl} nameHint={me.username} size={24} />
                  </span>
                  <span>{t.nav.profile}</span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 h-10 rounded-md border border-border text-sm hover:bg-accent cursor-pointer"
                >
                  <i className="fa-regular fa-user" />
                  <span>{t.nav.login}</span>
                </Link>
              )}
            </nav>

            <div className="px-4 py-3 text-xs text-foreground/60 border-t border-border">
              © {new Date().getFullYear()} MakaronComiks
            </div>
          </div>
        </div>
      )}

      {/* search modal (md<=lg) */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[65] hidden md:flex lg:hidden"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative h-full w-full flex items-start justify-center p-4">
            <div className="w-full max-w-lg mt-24 rounded-xl border border-border bg-background p-4 shadow-2xl">
              <SearchBox autoFocus onDone={() => setSearchOpen(false)} placeholder={t.search.placeholderLg} size="lg" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
