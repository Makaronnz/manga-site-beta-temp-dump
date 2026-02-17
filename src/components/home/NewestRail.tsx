import HomeRail from "@/components/HomeRail";
import { getMangaList, type RailItem } from "@/lib/mangadex-home";
import { type Rating } from "@/index";

export default async function NewestRail({
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
    const thisYear = new Date().getFullYear();

    const newest = await getMangaList({
        limit: 50,
        order: "followedCount",
        year: thisYear,
        ratings,
        excludedTags: blocked,
        lang: lang,
        ignoreLangFilter: true,
    }).catch(() => ({ items: [] }));

    const newItems: RailItem[] = (newest.items as any[] || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        cover: m.cover,
        description: "",
        lang: lang,
    }));

    return <HomeRail title={title} items={newItems} />;
}
