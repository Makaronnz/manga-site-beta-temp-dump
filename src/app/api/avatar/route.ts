// src/app/api/avatar/route.ts
// Avatar upload / default select / reset + eski dosyaları temizleme (prune)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient as createSb } from "@supabase/supabase-js";
import { supabaseFromCookies } from "@/lib/supabase-route";
import { resolveAvatarUrl } from "@/lib/avatar";

// ---------------- config ----------------
const BUCKET = "avatars";
const MAX_BYTES = 60 * 1024; // ~60KB
const DEFAULT_KEY = "defaults/1.webp"; // bucket içindeki path
// ---------------------------------------

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSb(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// user_profiles.avatar_url güncelle
async function setUserAvatarPath(userId: string, path: string) {
  const sb = admin();
  const { error } = await sb
    .from("user_profiles")
    .update({ avatar_url: path })
    .eq("auth_uid", userId);
  if (error) throw error;
}

// (opsiyonel) auth metadata güncelle (bazı UI'lar buradan da okuyabilir)
async function updateAuthMetaAvatar(userId: string, value: string) {
  const sb = admin();
  await sb.auth.admin.updateUserById(userId, {
    user_metadata: { avatar_url: value },
  });
}

// Kullanıcının klasöründeki (userId/) YÜKLENMİŞ tüm dosyaları sil.
// keepKeys: silinmeyecek tam path'ler (örn: ["<userId>/123.webp"])
async function pruneUserFolder(userId: string, keepKeys: string[] = []) {
  const sb = admin();
  // userId klasörünü listele
  const { data: files, error: listErr } = await sb.storage
    .from(BUCKET)
    .list(userId, { limit: 1000, offset: 0, sortBy: { column: "created_at", order: "desc" } });

  if (listErr) {
    console.error("avatar prune list error:", listErr);
    return;
  }

  if (!files || files.length === 0) return;

  const keepSet = new Set(keepKeys);
  const toDelete = files
    .map((f) => `${userId}/${f.name}`)
    .filter((full) => !keepSet.has(full)); // yeni dosyayı koru

  if (toDelete.length === 0) return;

  const { error: delErr } = await sb.storage.from(BUCKET).remove(toDelete);
  if (delErr) {
    console.error("avatar prune remove error:", delErr, "paths:", toDelete);
  }
}

function sanitizeDefaultKey(v?: string | null) {
  if (!v) return null;
  const s = String(v).trim().replace(/^\/+/, "");
  if (!s.startsWith("defaults/")) return null;       // sadece defaults klasörüne izin
  if (s.includes("..")) return null;
  if (!/\.(webp|png|jpg|jpeg)$/.test(s)) return null;
  return s;
}

export async function POST(req: Request) {
  try {
    const supa = await supabaseFromCookies(); // <-- cookies() async
    const { data: auth } = await supa.auth.getUser();
    const user = auth.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ctype = req.headers.get("content-type") || "";

    // JSON body: default seçme veya reset
    if (ctype.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as any;

      // reset: defaults/1.webp'e dön ve user klasörünü tamamen temizle
      if (body?.reset) {
        await setUserAvatarPath(user.id, DEFAULT_KEY);
        await updateAuthMetaAvatar(user.id, DEFAULT_KEY);
        // Kullanıcının klasöründeki yüklemeleri tamamen temizle
        await pruneUserFolder(user.id, []); // hiçbirini koruma
        return NextResponse.json({
          ok: true,
          avatarPath: DEFAULT_KEY,
          avatarUrl: resolveAvatarUrl(DEFAULT_KEY, Date.now()),
        });
      }

      // belirli bir defaults/<x>.webp seçimi
      const key = sanitizeDefaultKey(body?.defaultKey);
      if (!key) return NextResponse.json({ error: "Invalid defaultKey" }, { status: 400 });

      await setUserAvatarPath(user.id, key);
      await updateAuthMetaAvatar(user.id, key);
      // İstersek burada da kullanıcı klasörünü temizleyebiliriz:
      await pruneUserFolder(user.id, []);

      return NextResponse.json({
        ok: true,
        avatarPath: key,
        avatarUrl: resolveAvatarUrl(key, Date.now()),
      });
    }

    // multipart/form-data: dosya yükleme
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `File too large. Max ${Math.round(MAX_BYTES / 1024)}KB` },
          { status: 413 }
        );
      }
      if (!/^image\//i.test(file.type || "image/webp")) {
        return NextResponse.json({ error: "Invalid file type" }, { status: 415 });
      }

      // dosya adı: <userId>/<timestamp>.<ext>
      const ext =
        (file.type && file.type.includes("png")) ? "png" :
          (file.type && file.type.includes("jpeg")) ? "jpg" : "webp";
      const filename = `${user.id}/${Date.now()}.${ext}`;

      const ab = await file.arrayBuffer();
      const sb = admin();

      // Önce yükle
      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(filename, new Uint8Array(ab), {
          contentType: file.type || "image/webp",
          upsert: true,
          cacheControl: "3600",
        });
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }

      // Sonra DB + (opsiyonel) auth metadata
      await setUserAvatarPath(user.id, filename);
      await updateAuthMetaAvatar(user.id, filename);

      // 🔥 Eski dosyaları temizle (yenisi hariç hepsi)
      await pruneUserFolder(user.id, [filename]);

      return NextResponse.json({
        ok: true,
        avatarPath: filename,
        avatarUrl: resolveAvatarUrl(filename, Date.now()), // cache-bust
      });
    }

    return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
  } catch (err: any) {
    console.error("avatar route error:", err);
    const msg = typeof err?.message === "string" ? err.message : "Internal Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supa = await supabaseFromCookies();
    const { data: auth } = await supa.auth.getUser();
    const user = auth.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // default'a dön + tüm user klasörünü temizle
    await setUserAvatarPath(user.id, DEFAULT_KEY);
    await updateAuthMetaAvatar(user.id, DEFAULT_KEY);
    await pruneUserFolder(user.id, []);

    return NextResponse.json({
      ok: true,
      avatarPath: DEFAULT_KEY,
      avatarUrl: resolveAvatarUrl(DEFAULT_KEY, Date.now()),
    });
  } catch (err: any) {
    console.error("avatar route delete error:", err);
    const msg = typeof err?.message === "string" ? err.message : "Internal Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
