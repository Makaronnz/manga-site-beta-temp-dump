
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

async function createClient() {
    const jar = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (n: string) => jar.get(n)?.value,
                set: (n: string, v: string, o: any) => jar.set({ name: n, value: v, ...o }),
                remove: (n: string, o: any) => jar.delete({ name: n, ...o }),
            },
        } as any,
    );
}

function createAdmin() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return null;
    return createSupabaseAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key,
        { auth: { persistSession: false } }
    );
}

const AVATAR_BUCKET = "avatars";

export async function POST(req: Request) {
    try {
        const supa = await createClient();
        const { data: auth, error: authError } = await supa.auth.getUser();

        if (authError || !auth?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body: any = await req.json().catch(() => ({ deleteId: null }));
        const { deleteId } = body;

        if (!deleteId || deleteId !== auth.user.id) {
            return NextResponse.json({ error: "ID Verification Failed" }, { status: 400 });
        }

        const admin = createAdmin();
        if (!admin) {
            console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
            return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
        }

        // 1. Delete avatars
        const bucket = admin.storage.from(AVATAR_BUCKET);
        const dir = auth.user.id;
        const { data: files } = await bucket.list(dir);
        if (files && files.length > 0) {
            const paths = files.map(f => `${dir}/${f.name}`);
            await bucket.remove(paths);
        }

        // 2. Delete user profile (assuming cascade might handle it, but explicit is safer)
        await admin.from("user_profiles").delete().eq("auth_uid", auth.user.id);

        // 3. Delete user library/history (if not cascaded)
        await admin.from("user_library").delete().eq("user_id", auth.user.id);
        await admin.from("reading_history").delete().eq("user_id", auth.user.id);
        await admin.from("reading_progress_ext").delete().eq("user_id", auth.user.id);

        // 4. Delete Auth User (Critical)
        const { error: delError } = await admin.auth.admin.deleteUser(auth.user.id);
        if (delError) {
            console.error("Delete User Error:", delError);
            return NextResponse.json({ error: "Failed to delete user account" }, { status: 500 });
        }

        // 5. Sign out
        await supa.auth.signOut();

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error("/api/profile/delete error:", e);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
