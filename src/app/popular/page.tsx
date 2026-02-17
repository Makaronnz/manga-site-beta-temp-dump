// src/app/popular/page.tsx
export const runtime = "nodejs";

import LatestClient from "@/components/LatestClient";

export const metadata = {
    title: "Most Popular – MakaronComiks",
};

// We don't really need searchParams for initial sort here since we force "popular"
// But we pass it if we want to support ?q=... from server in future.
type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

export default async function PopularPage({
    searchParams,
}: {
    searchParams: SearchParamsPromise;
}) {
    const sp = await searchParams;
    const rawQ = sp?.q;
    const initialTitle =
        typeof rawQ === "string" ? rawQ : Array.isArray(rawQ) ? rawQ[0] ?? "" : "";

    return (
        <div className="container mx-auto px-4 md:px-6 py-8">
            {/* We removed the static header <h1> here. 
          The client component will render the localized header. 
      */}
            <LatestClient initialTitle={initialTitle} initialSort="popular" />
        </div>
    );
}
