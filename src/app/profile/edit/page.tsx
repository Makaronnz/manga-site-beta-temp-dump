// src/app/profile/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AvatarUploader from "@/components/AvatarUploader";
import { useLang } from "@/components/LanguageProvider";
import { Lang } from "@/lib/i18n";

export interface UserProfile {
  id: string;
  username: string;
  avatarUrl?: string;
  about?: string;
  email?: string;
}

function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function EditProfilePage() {
  const { lang, setLang, t } = useLang();
  const [tab, setTab] = useState<"profile" | "account">("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [data, setData] = useState<UserProfile | null>(null);

  // Form states
  const [about, setAbout] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Delete state
  const [deleteId, setDeleteId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/me");
        if (!res.ok) throw new Error("Not logged in");
        const json: any = await res.json();
        if (!json.user) throw new Error("No user data");
        setData(json.user);
        setAbout(json.user.about || "");
      } catch (e) {
        // redirect or show error
        setError("Please log in to edit profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveProfile() {
    setSaving(true); setSuccess(""); setError("");
    try {
      const res = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setSuccess(t.settings.saved);
    } catch {
      setError("Error saving profile.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAccount(updatePassword = false) {
    if (updatePassword && newPassword.length < 6) {
      setError("Password too short");
      return;
    }
    setSaving(true); setSuccess(""); setError("");
    try {
      // Dummy endpoint or real implementation
      // const res = await fetch("/api/auth/update", ... )
      await new Promise(r => setTimeout(r, 800)); // simulation
      setSuccess(t.settings.saved);
      setPassword(""); setNewPassword(""); // clear inputs
    } catch {
      setError("Error updating account.");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteAccount() {
    if (deleteId !== data?.id) {
      setError((t as any).editProfile.deleteIdMismatch || "ID does not match");
      return;
    }
    if (!window.confirm((t as any).editProfile.deleteConfirm || "Are you sure you want to delete your account? This cannot be undone.")) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteId }),
      });

      if (!res.ok) {
        const j: any = await res.json().catch(() => ({}));
        throw new Error(j.error || "Deletion failed");
      }

      // Success - signout is handled by backend but client should redirect/refresh
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete account");
      setSaving(false);
    }
  }

  async function onLogout() {
    await fetch("/auth/signout", { method: "POST" });
    window.location.href = "/";
  }

  if (loading) {
    return <div className="p-10 text-center opacity-60">{t.browse.loading}</div>;
  }
  if (!data) {
    return <div className="p-10 text-center text-red-500">{error || "Error loading profile."}</div>;
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-10 md:py-14">
      {/* Breadcrumb / Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href={`/profile`} className="hover:text-foreground hover:underline">← {t.settings.back}</Link>
      </div>

      <h1 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">{t.editProfile.title}</h1>

      {/* Tabs */}
      <div className="mt-6 border-b border-border flex items-center gap-4">
        <button
          className={cx("h-10 px-3 text-sm cursor-pointer border-b-2 transition-colors", tab === "profile" ? "border-foreground font-medium" : "border-transparent opacity-70 hover:opacity-100")}
          onClick={() => setTab("profile")}
        >
          <i className="fa-regular fa-id-card mr-2" /> {t.editProfile.tabs.profile}
        </button>
        <button
          className={cx("h-10 px-3 text-sm cursor-pointer border-b-2 transition-colors", tab === "account" ? "border-foreground font-medium" : "border-transparent opacity-70 hover:opacity-100")}
          onClick={() => setTab("account")}
        >
          <i className="fa-regular fa-user mr-2" /> {t.editProfile.tabs.account}
        </button>
      </div>

      {/* Messages */}
      {error && <div className="mt-4 p-3 rounded bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>}
      {success && <div className="mt-4 p-3 rounded bg-green-50 text-green-600 text-sm border border-green-100">{success}</div>}

      <div className="mt-8 max-w-2xl">
        {/* PROFILE TAB */}
        {tab === "profile" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Avatar */}
            <section>
              <h2 className="text-lg font-semibold mb-1 ">{t.editProfile.avatar}</h2>
              <div className="flex items-start gap-6 mt-4">
                <AvatarUploader
                  initialUrl={data.avatarUrl || null}
                  onChanged={(url: string | null) => {
                    setData({ ...data, avatarUrl: url || undefined });
                    setSuccess((t as any).settings.saved);
                  }}
                />
                <div className="text-sm opacity-70 mt-2 max-w-xs">
                  Click the image to upload a new avatar. Recommended size: 256x256px.
                </div>
              </div>
            </section>

            <hr className="border-border" />

            {/* About */}
            <section>
              <h2 className="text-lg font-semibold mb-1">{t.editProfile.about}</h2>
              <p className="text-sm opacity-60 mb-3">{t.editProfile.aboutPlaceholder}</p>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="I like reading fantasy and slice of life..."
              />
              <div className="mt-4 flex justify-end">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="h-10 rounded-md bg-blue-600 px-6 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? t.settings.saving : t.settings.save}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ACCOUNT TAB */}
        {tab === "account" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <section>
              <h2 className="text-lg font-semibold mb-4">{t.editProfile.infoTitle}</h2>
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium opacity-70 block mb-1">{t.editProfile.id}</label>
                  <input disabled value={data.id} className="w-full h-10 px-3 rounded-md border bg-muted/50 text-muted-foreground font-mono text-xs" />
                </div>
                <div>
                  <label className="text-sm font-medium opacity-70 block mb-1">{t.editProfile.accountUser}</label>
                  <input disabled value={data.username} className="w-full h-10 px-3 rounded-md border bg-muted/50 text-muted-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium opacity-70 block mb-1">{t.editProfile.accountEmail}</label>
                  <input disabled value={data.email || "No email"} className="w-full h-10 px-3 rounded-md border bg-muted/50 text-muted-foreground" />
                </div>
              </div>
            </section>

            <hr className="border-border" />

            <section>
              <h2 className="text-lg font-semibold mb-4">{t.editProfile.changePassTitle}</h2>
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium opacity-70 block mb-1">{t.editProfile.newPass}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t.editProfile.newPassPlaceholder}
                    className="w-full h-10 px-3 rounded-md border bg-background"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => saveAccount(true)}
                    disabled={saving || !newPassword}
                    className="h-10 rounded-md bg-blue-600 px-6 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? t.settings.saving : t.editProfile.update}
                  </button>
                </div>
              </div>
            </section>

            <hr className="border-border" />

            {/* Logout */}
            <section>
              <h2 className="text-lg font-semibold mb-2 text-neutral-600 dark:text-neutral-400">{t.editProfile.sessionTitle}</h2>
              <button
                onClick={onLogout}
                className="h-10 px-4 rounded-md border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400 text-sm font-medium transition-colors"
              >
                {t.editProfile.logout}
              </button>
              <p className="mt-2 text-xs opacity-60">
                {t.editProfile.logoutDesc}
              </p>
            </section>

            <hr className="border-border" />

            {/* DELETE ACCOUNT */}
            <section className="p-4 border border-red-200 bg-red-50 dark:bg-red-950/10 dark:border-red-900/30 rounded-lg">
              <h2 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">Delete Account</h2>
              <p className="text-sm opacity-80 mb-4 text-red-700 dark:text-red-300">
                To confirm deletion, please paste your User ID below. <br />
                <span className="font-medium">Your ID:</span> <code className="bg-black/10 px-1 rounded select-all">{data.id}</code>
              </p>

              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium opacity-70 block mb-1 uppercase tracking-wider text-red-800 dark:text-red-300">Verify ID</label>
                  <input
                    value={deleteId}
                    onChange={(e) => setDeleteId(e.target.value)}
                    placeholder="Paste ID here..."
                    className="w-full h-10 px-3 rounded-md border border-red-200 dark:border-red-900/50 bg-white dark:bg-black/20 text-sm font-mono"
                  />
                </div>
                <button
                  onClick={onDeleteAccount}
                  disabled={saving || !deleteId}
                  className="h-10 px-4 rounded-md bg-red-600 text-white font-medium text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Delete My Account
                </button>
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
