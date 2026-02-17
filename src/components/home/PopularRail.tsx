
import HomeRail, { type RailItem } from "@/components/HomeRail";
import { type Rating } from "@/index";
import { getMostRecentPopularDirect, getMangaList } from "@/lib/mangadex-home";

export default async function PopularRail({
    title,
    ratings,
    blocked,
    lang
}: {
    title: string;
    ratings: Rating[];
    blocked: string[];
    lang: string;
}) {
    let popularItems: RailItem[] = [];
    try {
        popularItems = await getMostRecentPopularDirect("follows", 30, 24, ratings, blocked, lang);
        if (popularItems.length === 0) {
            popularItems = await getMostRecentPopularDirect("follows", 90, 24, ratings, blocked, lang);
        }
    } catch {
        // ignore
    }

    if (popularItems.length === 0) {
        const latest = await getMangaList({
            limit: 50,
            order: "latestUploadedChapter",
            ratings,
            excludedTags: blocked,
            lang: lang,
        }).catch(() => ({ items: [] as any[] }));

        popularItems = (latest.items || []).slice(0, 24).map((m: any) => ({
            id: m.id,
            title: m.title,
            cover: m.cover,
            description: "",
            lang: lang,
        }));
    }

    return <HomeRail title={title} items={popularItems} />;
}
