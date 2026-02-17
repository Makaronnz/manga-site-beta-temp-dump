
import { supabaseFromCookiesReadOnly } from "@/lib/supabase-route";

export type UserProfile = {
    id: string; // auth_uid
    username: string;
    avatarUrl: string | null;
    joinedAt: string;
    about: string | null;
    links: string[];
    lastActiveAt?: string | null;
};

export type LibraryItem = {
    seriesId: string;
    title: string;
    coverUrl: string | null;
    rating: number;
    readingStatus: "Reading" | "Completed" | "On-Hold" | "Dropped" | "Plan to Read";
    seriesStatus: "Ongoing" | "Completed" | "Cancelled" | "Hiatus";
    updatedAt: string | null; // used for sorting
    lastReadAt: string | null;
    progress: string | null; // e.g. "10 / ?"
};

export type CommentItem = {
    id: string;
    seriesId: string;
    seriesTitle: string;
    chapterId: string | null;
    body: string;
    createdAt: string;
};

export type ProfileData = {
    user: UserProfile;
    stats: { totalChaptersRead: number };
    library: LibraryItem[];
    comments: CommentItem[];
    privacy: {
        library: boolean;
        progress: boolean;
        comments: boolean;
    };
    isOwner: boolean;
};

export async function getPublicProfile(targetUsername: string): Promise<{ data: ProfileData | null; error: string | null; status: number }> {
    const db = await supabaseFromCookiesReadOnly();

    // 1. Get Viewer
    const { data: { user: viewer } } = await db.auth.getUser();

    // 2. Get Target Profile
    const { data: prof, error: profErr } = await db
        .from("user_profiles")
        .select("auth_uid, username, avatar_url, created_at, about, links, library_public, progress_public, comments_public")
        .ilike("username", targetUsername)
        .maybeSingle();

    if (profErr) {
        return { data: null, error: profErr.message, status: 500 };
    }
    if (!prof) {
        return { data: null, error: "User not found", status: 404 };
    }

    const isOwner = !!viewer && viewer.id === prof.auth_uid;

    const user: UserProfile = {
        id: prof.auth_uid,
        username: prof.username,
        avatarUrl: prof.avatar_url,
        joinedAt: prof.created_at, // Use profile creation date usually
        about: prof.about,
        links: Array.isArray(prof.links) ? prof.links.filter(Boolean) : [],
        lastActiveAt: null, // Not currently tracking active status in public view easily without extra table
    };

    // 3. Fetch Library
    let library: LibraryItem[] = [];
    if (isOwner || prof.library_public) {
        // Try user_library first
        const { data: lib, error: libErr } = await db
            .from("user_library")
            .select("series_id, status, updated_at, series:series_id ( title, cover_url, status )")
            .eq("user_id", prof.auth_uid)
            .order("updated_at", { ascending: false })
            .limit(500);

        if (lib && lib.length > 0) {
            library = lib.map((r: any) => ({
                seriesId: String(r.series_id),
                title: r.series?.title || "Untitled",
                coverUrl: r.series?.cover_url || null,
                rating: 0,
                readingStatus: (r.status || "Reading"),
                seriesStatus: (r.series?.status || "Ongoing"),
                updatedAt: r.updated_at,
                lastReadAt: null,
                progress: null,
            }));
        } else {
            // Fallback to follows if library is empty (legacy behavior support)
            const { data: flw } = await db
                .from("follows")
                .select("series_id, created_at, series:series_id ( title, cover_url, status )")
                .eq("user_id", prof.auth_uid)
                .order("created_at", { ascending: false })
                .limit(500);

            if (flw) {
                library = flw.map((r: any) => ({
                    seriesId: String(r.series_id),
                    title: r.series?.title || "Untitled",
                    coverUrl: r.series?.cover_url || null,
                    rating: 0,
                    readingStatus: "Reading",
                    seriesStatus: (r.series?.status || "Ongoing"),
                    updatedAt: r.created_at,
                    lastReadAt: null,
                    progress: null,
                }));
            }
        }
    }

    // 4. Fetch Comments
    let comments: CommentItem[] = [];
    if (isOwner || prof.comments_public) {
        const { data: cm } = await db
            .from("comments")
            .select("id, series_id, chapter_id, content, created_at, series:series_id ( title )")
            .eq("user_id", prof.auth_uid)
            .order("created_at", { ascending: false })
            .limit(100);

        if (cm) {
            comments = cm.map((c: any) => ({
                id: String(c.id),
                seriesId: String(c.series_id),
                seriesTitle: c.series?.title || "Untitled",
                chapterId: c.chapter_id ? String(c.chapter_id) : null,
                body: c.content,
                createdAt: c.created_at,
            }));
        }
    }

    // 5. Reading Progress (for stats and library progress overlay)
    let totalChaptersRead = 0;
    // Map seriesId -> progress
    const readingMap = new Map<string, { chapter: string; updatedAt: string }>();

    if (isOwner || prof.progress_public) {
        const { data: rpe } = await db
            .from("reading_progress_ext")
            .select("series_id, chapter_label, updated_at")
            .eq("user_id", prof.auth_uid);

        if (rpe) {
            for (const r of rpe) {
                const sid = String(r.series_id);
                // Simple total count approximation (number of entries)
                // Real "total chapters read" is harder if we store only last read per series in this view?
                // `reading_progress_ext` is a view or table? In `page.tsx`, it selected `chapter_label`.
                // Actually `reading_progress` is usually one row per user-chapter.
                // If `reading_progress_ext` is "last read per series", then summing it is wrong for "total read".
                // But `page.tsx` used `reading_progress_ext` and iterated.
                // Let's assume `reading_progress_ext` contains all read history or `reading_history` does.
                // Re-reading `page.tsx`: 
                // `const { data: rpe } = await supabase.from("reading_progress_ext")...`
                // And explicitly: `readingInit[sid] = ...` -> it seems to flatten to one entry per series.
                // Then `totalChaptersRead` sums `parseChapterNum(ent.chapter)`. 
                // Ah, it sums the *chapter number* of the last read chapter? That's... a specific way to count.
                // "Read up to chapter X". Okay, I will replicate that logic.

                const cur = readingMap.get(sid);
                const newer = !cur || (r.updated_at && (!cur.updatedAt || r.updated_at > cur.updatedAt));
                if (newer) {
                    readingMap.set(sid, {
                        chapter: r.chapter_label || "0",
                        updatedAt: r.updated_at
                    });
                }
            }
        }
    }

    // Calculate total & merge into library
    for (const [sid, prog] of readingMap.entries()) {
        const num = parseFloat(prog.chapter.match(/[\d.]+/g)?.join("") || "0");
        if (Number.isFinite(num)) totalChaptersRead += num;

        // Merge into library item if exists
        const libItem = library.find(i => i.seriesId === sid);
        if (libItem) {
            libItem.progress = `${num} / ?`;
            libItem.lastReadAt = prog.updatedAt;
        }
    }

    return {
        data: {
            user,
            stats: { totalChaptersRead },
            library,
            comments,
            privacy: {
                library: !!prof.library_public,
                progress: !!prof.progress_public,
                comments: !!prof.comments_public,
            },
            isOwner,
        },
        error: null,
        status: 200
    };
}
