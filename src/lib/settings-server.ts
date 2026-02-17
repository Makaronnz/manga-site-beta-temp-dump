
import { cookies } from "next/headers";

export type UserSettings = {
    lang: string;
    contentLang: string;
    nsfw: boolean;
    blocked: string[];
};

export async function getUserSettings(): Promise<UserSettings> {
    const cs = await cookies();
    const lang = cs.get("mc_lang")?.value || "en";
    const contentLang = cs.get("mc_content_lang")?.value || "en";
    const safe = cs.get("mc_safe")?.value || "sfw1";
    const blockedRaw = cs.get("mc_blocked")?.value || "";

    const blocked = blockedRaw.split(",").filter(Boolean);

    // Logic: 'nsfw' means explicitly allowed. 'sfw1'/'sfw2' or missing means safe.
    const nsfw = safe === "nsfw";

    return { lang, contentLang, nsfw, blocked };
}
