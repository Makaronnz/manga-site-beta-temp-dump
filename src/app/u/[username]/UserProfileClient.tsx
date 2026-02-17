
"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import AvatarImg from "@/components/AvatarImg";
import { useLang } from "@/components/LanguageProvider";
import type { ProfileData, LibraryItem, CommentItem } from "@/lib/profile-controller";

function fromNow(iso?: string | null) {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.max(1, Math.floor(diff / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    const wk = Math.floor(day / 7);
    if (wk < 4) return `${wk}w ago`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    const yr = Math.floor(mo / 12);
    return `${yr}y ago`;
}
function cx(...arr: Array<string | false | null | undefined>) {
    return arr.filter(Boolean).join(" ");
}

export default function UserProfileClient({ data }: { data: ProfileData }) {
    const { t, lang } = useLang();
    const sp = useSearchParams();
    const initialTab = (sp.get("tab") as "overview" | "library" | "comments" | null) || "overview";
    const [tab, setTab] = useState<"overview" | "library" | "comments">(initialTab);

    const { user, library, comments, privacy, isOwner, stats } = data;

    const joinedAbs = new Date(user.joinedAt).toLocaleDateString(lang, {
        year: "numeric", month: "short", day: "numeric",
    });
    const joinedRel = fromNow(user.joinedAt);

    return (
        <div className="container mx-auto px-4 md:px-6 py-10 md:py-14">
            {/* Header */}
            <div className="flex items-center gap-4 md:gap-6">
                <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border border-border">
                    <AvatarImg src={user.avatarUrl} nameHint={user.username} size={80} alt={`${user.username} avatar`} />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{user.username}</h1>
                    <div className="text-sm opacity-80">
                        {user.lastActiveAt ? (
                            <span className="mr-4">{t.profile.lastActive} {fromNow(user.lastActiveAt)}</span>
                        ) : null}
                        <span>
                            {t.profile.joined} {joinedAbs} <span className="opacity-70">({joinedRel})</span>
                        </span>
                    </div>
                </div>
                {isOwner && (
                    <div className="flex gap-2">
                        <Link href="/profile/edit" className="shrink-0 inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm hover:bg-accent cursor-pointer">
                            <i className="fa-regular fa-pen-to-square mr-2" /> {t.profile.edit}
                        </Link>
                    </div>
                )}
            </div>

            {user.about && (
                <div className="mt-6 max-w-2xl">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed opacity-90">{user.about}</p>
                </div>
            )}

            {/* Stats */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-lg border border-border p-5">
                    <div className="text-sm opacity-70">{t.profile.stats.chaptersRead}</div>
                    <div className="text-3xl font-semibold mt-1">{privacy.progress || isOwner ? stats.totalChaptersRead : "—"}</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mt-10">
                <div className="flex items-center gap-2 border-b border-border">
                    {(["overview", "library", "comments"] as const).map((k) => (
                        <button
                            key={k}
                            className={cx("h-10 px-4 text-sm cursor-pointer capitalize", tab === k ? "border-b-2 border-foreground font-medium" : "opacity-70 hover:opacity-100")}
                            onClick={() => setTab(k)}
                        >
                            {t.profile.tabs[k]}
                        </button>
                    ))}
                </div>

                {tab === "overview" && (
                    <OverviewPreview library={library} comments={comments} setTab={setTab} t={t} privacy={privacy} isOwner={isOwner} />
                )}
                {tab === "library" && (
                    (privacy.library || isOwner) ? <LibraryTable items={library} /> : <PrivateMsg t={t} />
                )}
                {tab === "comments" && (
                    (privacy.comments || isOwner) ? <CommentsList comments={comments} /> : <PrivateMsg t={t} />
                )}
            </div>
        </div>
    );
}

function PrivateMsg({ t }: { t: any }) {
    return <div className="rounded-lg border border-border p-6 opacity-80 mt-6">{t.profile.privateLib}</div>;
}

function OverviewPreview({ library, comments, setTab, t, privacy, isOwner }: any) {
    const top4 = library.slice(0, 4);

    return (
        <div className="pt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-border p-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">{t.profile.yourLibrary}</h2>
                    <button className="text-sm opacity-80 hover:opacity-100 underline underline-offset-2" onClick={() => setTab("library")}>
                        {t.profile.viewAll}
                    </button>
                </div>
                {(!privacy.library && !isOwner) ? (
                    <div className="opacity-80 mt-4">{t.profile.privateLib}</div>
                ) : top4.length === 0 ? (
                    <div className="opacity-80 mt-4">{t.profile.emptyLib}</div>
                ) : (
                    <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                        {top4.map((s: LibraryItem) => (
                            <li key={s.seriesId} className="group">
                                <Link href={`/series/${s.seriesId}`} className="block">
                                    <div className="relative w-full aspect-[3/4] rounded-md overflow-hidden border border-border/60">
                                        {s.coverUrl ? (
                                            <Image src={s.coverUrl} alt={s.title} fill className="object-cover group-hover:scale-[1.02] transition" sizes="200px" />
                                        ) : (
                                            <div className="absolute inset-0 bg-muted flex items-center justify-center text-xs">No Cover</div>
                                        )}
                                    </div>
                                    <div className="mt-2 text-sm font-medium line-clamp-1">{s.title}</div>
                                    {s.progress && <div className="text-xs opacity-70">{s.progress}</div>}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Comments Preview */}
            <div className="rounded-lg border border-border p-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">{t.profile.recentComments}</h2>
                    <button className="text-sm opacity-80 hover:opacity-100 underline underline-offset-2" onClick={() => setTab("comments")}>
                        {t.profile.viewAll}
                    </button>
                </div>
                {(!privacy.comments && !isOwner) ? (
                    <div className="opacity-80 mt-4">{t.profile.privateLib}</div>
                ) : comments.length === 0 ? (
                    <div className="opacity-80 mt-4">{t.profile.emptyComments}</div>
                ) : (
                    <ul className="mt-4 space-y-4">
                        {comments.slice(0, 6).map((c: CommentItem) => (
                            <li key={c.id} className="rounded-md border border-border p-3">
                                <div className="text-sm mb-1">
                                    <Link href={`/series/${c.seriesId}`} className="font-medium hover:underline">{c.seriesTitle}</Link>
                                    {c.chapterId ? <span className="opacity-70"> · {c.chapterId}</span> : null}
                                    <span className="opacity-70"> · {fromNow(c.createdAt)}</span>
                                </div>
                                <div className="text-sm opacity-90 line-clamp-2">{c.body}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function LibraryTable({ items }: { items: LibraryItem[] }) {
    if (items.length === 0) return <div className="mt-6 opacity-70">Library is empty.</div>;
    return (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map(s => (
                <Link key={s.seriesId} href={`/series/${s.seriesId}`} className="group block">
                    <div className="relative w-full aspect-[3/4] rounded-md overflow-hidden border border-border/60">
                        {s.coverUrl ? (
                            <Image src={s.coverUrl} alt={s.title} fill className="object-cover group-hover:scale-[1.02] transition" sizes="200px" />
                        ) : (
                            <div className="absolute inset-0 bg-muted flex items-center justify-center text-xs">No Cover</div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
                            {s.readingStatus}
                        </div>
                    </div>
                    <div className="mt-2 text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">{s.title}</div>
                    <div className="text-xs opacity-70 flex justify-between">
                        <span>{s.progress || "0 / ?"}</span>
                    </div>
                </Link>
            ))}
        </div>
    );
}

function CommentsList({ comments }: { comments: CommentItem[] }) {
    if (comments.length === 0) return <div className="mt-6 opacity-70">No comments.</div>;
    return (
        <div className="mt-6 space-y-4 max-w-3xl">
            {comments.map((c) => (
                <div key={c.id} className="flex gap-4 p-4 rounded-lg border border-border bg-card/50">
                    <div className="grow">
                        <div className="flex items-baseline justify-between mb-1">
                            <div className="text-sm">
                                <span className="opacity-70">Commented on </span>
                                <Link href={`/series/${c.seriesId}`} className="font-medium hover:underline">{c.seriesTitle}</Link>
                                {c.chapterId && <span className="opacity-70"> (Ch. {c.chapterId})</span>}
                            </div>
                            <span className="text-xs opacity-50">{fromNow(c.createdAt)}</span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
