'use client';

import { FlagIcon } from "@/components/FlagIcon";
import { useEffect, useMemo, useState } from 'react';
import { useLang } from "@/components/LanguageProvider";
import { createBrowserClient } from "@supabase/ssr";

type SafeMode = 'sfw1' | 'sfw2' | 'nsfw';

type Tag = { id: string; group: string; name: string };

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Turkish' },
  { code: 'de', label: 'German' },
  { code: 'pl', label: 'Polish' },
  { code: 'es', label: 'Spanish' },
  { code: 'es-la', label: 'Spanish (LATAM)' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese (Portugal)' },
  { code: 'pt-br', label: 'Portuguese (Brazil)' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese (Simp)' },
  { code: 'zh-hk', label: 'Chinese (Trad)' },
  { code: 'it', label: 'Italian' },
  { code: 'id', label: 'Indonesian' },
  { code: 'th', label: 'Thai' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
];

function setCookie(name: string, value: string, days = 400) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

export default function SettingsPage() {
  const { t, lang, setLang } = useLang();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // State
  const [safeMode, setSafeMode] = useState<SafeMode>('sfw1');
  const [tags, setTags] = useState<Tag[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Initial Load (Client only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSafe = (localStorage.getItem('mc_safe') as SafeMode) || 'sfw1';
      setSafeMode(savedSafe);

      try {
        const bg = localStorage.getItem('mc_blocked');
        if (bg) setBlocked(JSON.parse(bg));
      } catch { }

      // Try load from DB if logged in
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          supabase.from('user_profiles').select('prefs').eq('auth_uid', session.user.id).single()
            .then(({ data }) => {
              if (data?.prefs?.blocked) setBlocked(data.prefs.blocked);
              // if (data?.prefs?.safeMode) setSafeMode(data.prefs.safeMode);
            });
        }
      });
    }
  }, []);

  // Load Tags
  useEffect(() => {
    fetch('/api/series/tags', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: any) => setTags(j?.tags || []))
      .catch(() => setTags([]));
  }, []);

  // Filter Logic
  const filteredTags = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = needle
      ? tags.filter((t) => t.name.toLowerCase().includes(needle))
      : tags;
    const order = (g: string) =>
      g === 'genre' ? 0 : g === 'theme' ? 1 : g === 'format' ? 2 : 9;
    return [...rows].sort((a, b) => order(a.group) - order(b.group) || a.name.localeCompare(b.name));
  }, [tags, q]);

  const toggleBlocked = (id: string) => {
    setBlocked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const getGroupLabel = (g: string) => {
    if (g === 'genre') return t.tagGroups.genre;
    if (g === 'theme') return t.tagGroups.theme;
    if (g === 'format') return t.tagGroups.format;
    return g;
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // 1. Cookies
      setCookie('mc_safe', safeMode);
      setCookie('mc_blocked', blocked.join(','));

      // 2. LocalStorage
      localStorage.setItem('mc_safe', safeMode);
      localStorage.setItem('mc_blocked', JSON.stringify(blocked));

      // 3. Supabase (if logged in)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Fetch current prefs first
        const { data: profile } = await supabase.from('user_profiles').select('prefs').eq('auth_uid', session.user.id).single();
        const currentPrefs = profile?.prefs || {};
        const newPrefs = { ...currentPrefs, blocked };

        const { error } = await supabase.from('user_profiles').update({ prefs: newPrefs }).eq('auth_uid', session.user.id);
        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });

      // Reload to ensure cookies take effect middleware/server-side
      window.location.reload();

    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t.settingsPage.title}</h1>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
          {message.text}
        </div>
      )}

      {/* Interface Language */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">{t.settingsPage.languageTitle} (Interface)</h2>
        <p className="text-sm opacity-70 mb-3">{t.settingsPage.languageDesc}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {LANGS.filter(l => ["en", "tr", "es"].includes(l.code)).map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code as any)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${lang === l.code
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:bg-accent"
                }`}
            >
              <div className="w-8 h-6 rounded overflow-hidden shrink-0 border border-black/10">
                <FlagIcon lang={l.code} className="w-full h-full" />
              </div>
              <span className="font-medium text-sm">{l.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Content Language */}
      <section className="mb-10">
        <ContentLanguageSection lang={lang} />
      </section>

      {/* Safe Browsing */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">{t.settingsPage.safeModeTitle}</h2>
        <p className="text-sm opacity-70 mb-3">
          {t.settingsPage.safeModeDesc}
        </p>

        <label className="flex items-center gap-3 p-4 rounded-lg border border-border cursor-pointer hover:bg-accent/50">
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={safeMode === 'nsfw'}
              onChange={(e) => setSafeMode(e.target.checked ? 'nsfw' : 'sfw1')}
            />
            <div className="h-6 w-11 rounded-full bg-zinc-200 dark:bg-zinc-700 peer-checked:bg-red-600 transition-colors" />
            <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium">{t.settingsPage.showNsfw}</div>
            <div className="text-xs opacity-70">
              {t.settingsPage.nsfwDesc}
            </div>
          </div>
        </label>
      </section>

      {/* Block genres / tags */}
      <section className="mb-20">
        <h2 className="text-lg font-semibold mb-2">{t.settingsPage.blockTitle}</h2>
        <p className="text-sm opacity-70 mb-3">
          {t.settingsPage.blockDesc}
        </p>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.settingsPage.searchTags}
          className="mb-4 w-full md:w-96 h-10 rounded-md border border-input bg-background px-3"
        />

        <div className="flex flex-wrap gap-2 mb-4">
          {blocked.length > 0 && (
            <button
              onClick={() => setBlocked([])}
              className="text-xs text-red-500 hover:underline px-1"
            >
              {t.settingsPage.clearBlocked} ({blocked.length})
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-2 border rounded p-2">
          {filteredTags.map((t) => {
            const checked = blocked.includes(t.id);
            return (
              <label key={t.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${checked ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30" : "hover:bg-accent"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleBlocked(t.id)}
                  className="accent-red-600 w-4 h-4"
                />
                <span className="text-sm truncate flex-1">
                  <span className="font-medium mr-1">{t.name}</span>
                  <span className="opacity-50 text-[10px] uppercase border px-1 rounded">{getGroupLabel(t.group)}</span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="hidden md:inline-flex px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium text-sm disabled:opacity-50 shadow-sm"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      {/* Sticky Save Bar (Mobile Friendly) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border flex justify-end md:hidden z-50">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-medium shadow-lg w-full"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

    </main>
  );
}

function ContentLanguageSection({ lang: uiLang }: { lang: string }) {
  const [contentLang, setContentLang] = useState("en");

  // Load from cookie/localstorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const m = document.cookie.match(/mc_content_lang=([^;]+)/);
      if (m) setContentLang(decodeURIComponent(m[1]));
      else setContentLang("en");
    }
  }, []);

  const setCL = (c: string) => {
    // When saving manually we don't need instant reload here, but let's keep it consistent
    // Actually, user might want to save EVERYTHING at once.
    // For now, let's keep this isolated or merge it?
    // The prompt only asked for genres/tags "save" button.
    // But since this refreshes the page, it might conflict.
    // I will leave this as legacy behavior for now.
    setContentLang(c);
    setCookie("mc_content_lang", c);
    window.location.reload();
  };

  return (
    <>
      <h2 className="text-lg font-semibold mb-2">Content Language</h2>
      <p className="text-sm opacity-70 mb-3">Filter manga content by language.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto pr-2">
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setCL(l.code)}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg border text-left transition-colors ${contentLang === l.code
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border hover:bg-accent"
              }`}
          >
            <div className="w-6 h-4 rounded overflow-hidden shrink-0 border border-black/10">
              <FlagIcon lang={l.code} className="w-full h-full" />
            </div>
            <span className="font-medium text-sm truncate">{l.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
