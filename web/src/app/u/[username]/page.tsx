import { notFound } from "next/navigation";

import { PublicProfilePage, fetchPublicProfile } from "@/features/public-profile";

type PublicProfileRouteProps = {
  params: Promise<{
    username: string;
  }>;
};

export default async function PublicProfileRoute({ params }: PublicProfileRouteProps) {
  const { username } = await params;
  const profile = await fetchPublicProfile(username);

  if (!profile) {
    notFound();
  }

  return <PublicProfilePage profile={profile} />;
}
