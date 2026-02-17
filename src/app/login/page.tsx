// app/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useLang } from "@/components/LanguageProvider";

export default function LoginPage() {
  const { t } = useLang();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const t = sp.get("t");
    if (t === "signup") setTab("signup");
  }, [sp]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null); setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/profile");
    } catch (e: any) {
      setErr(e?.message || t.auth.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null); setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          // emailRedirectTo: `${location.origin}/login`
        },
      });
      if (error) throw error;

      // E-mail confirmation açıksa session gelmez → kullanıcıya bilgi ver
      if (!data.session) {
        setInfo(t.auth.checkEmail);
        return;
      }

      // Session varsa direkt profile
      router.replace("/profile");
    } catch (e: any) {
      setErr(e?.message || t.auth.signupFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-10 md:py-14 max-w-xl">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t.auth.welcome}</h1>

      <div className="mt-5 inline-flex rounded-md border overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => setTab("login")}
          className={`h-9 px-3 ${tab === "login" ? "bg-accent" : "hover:bg-accent"}`}
        >
          {t.auth.login}
        </button>
        <button
          type="button"
          onClick={() => setTab("signup")}
          className={`h-9 px-3 ${tab === "signup" ? "bg-accent" : "hover:bg-accent"}`}
        >
          {t.auth.signup}
        </button>
      </div>

      {tab === "login" ? (
        <form onSubmit={onLogin} className="mt-5 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm opacity-80">{t.auth.email}</span>
            <input
              type="email"
              required
              className="h-10 px-3 rounded-md border border-border bg-transparent outline-none focus:border-foreground/40"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm opacity-80">{t.auth.password}</span>
            <input
              type="password"
              required
              className="h-10 px-3 rounded-md border border-border bg-transparent outline-none focus:border-foreground/40"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {err && <p className="text-sm text-red-500">{err}</p>}
          {info && <p className="text-sm text-green-500">{info}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex items-center justify-center h-10 rounded-md border border-border px-4 hover:bg-accent disabled:opacity-60"
          >
            {busy ? t.auth.processing : t.auth.login}
          </button>
          <p className="text-sm opacity-80 mt-2">
            {t.auth.noAccount}{" "}
            <Link href="/login?t=signup" className="underline underline-offset-4">{t.auth.createOne}</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={onSignup} className="mt-5 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm opacity-80">{t.auth.username}</span>
            <input
              required
              className="h-10 px-3 rounded-md border border-border bg-transparent outline-none focus:border-foreground/40"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_nick"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm opacity-80">{t.auth.email}</span>
            <input
              type="email"
              required
              className="h-10 px-3 rounded-md border border-border bg-transparent outline-none focus:border-foreground/40"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm opacity-80">{t.auth.password}</span>
            <input
              type="password"
              required
              className="h-10 px-3 rounded-md border border-border bg-transparent outline-none focus:border-foreground/40"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.auth.password}
            />
          </label>
          {err && <p className="text-sm text-red-500">{err}</p>}
          {info && <p className="text-sm text-green-500">{info}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex items-center justify-center h-10 rounded-md border border-border px-4 hover:bg-accent disabled:opacity-60"
          >
            {busy ? t.auth.creating : t.auth.createAccount}
          </button>
          <p className="text-sm opacity-80 mt-2">
            {t.auth.hasAccount}{" "}
            <button type="button" onClick={() => setTab("login")} className="underline underline-offset-4">
              {t.auth.loginInstead}
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
