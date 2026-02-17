// src/app/group/[slug]/page.tsx
import GroupSeriesClient from "@/components/GroupSeriesClient";

export const dynamic = "force-dynamic";

export default async function GroupPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  // Next 15 ile Promise gelir
  return <GroupSeriesClient slug={decodeURIComponent(params.slug)} />;
}
