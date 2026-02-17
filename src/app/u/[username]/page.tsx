
import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/profile-controller";
import UserProfileClient from "./UserProfileClient";
import { useLang } from "@/components/LanguageProvider"; // Server comp can't use this? NO, useLang is client hook.
// Server components can't use hooks. Standard pattern: dictionary or pass t.
// Actually UserProfileClient uses useLang, so we are fine.

export const dynamic = "force-dynamic";

export default async function PublicProfilePage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const username = decodeURIComponent(params.username);

  const { data, status } = await getPublicProfile(username);

  if (status === 404 || !data) {
    notFound();
  }

  // Pass data to client comp
  return <UserProfileClient data={data} />;
}
