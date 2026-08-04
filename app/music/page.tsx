import MusicPageClient from "@/components/music/MusicPageClient";
import { loadTabPageProfile } from "@/lib/experience/load-tab-page-profile";

export default async function MusicPage() {
  const profile = await loadTabPageProfile();

  return (
    <main className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-brand-black">
      <MusicPageClient initialProfile={profile} />
    </main>
  );
}
