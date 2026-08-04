import ExperienceGivingPageClient from "@/components/experience/giving/ExperienceGivingPageClient";
import { loadTabPageProfile } from "@/lib/experience/load-tab-page-profile";

export default async function GivingPage() {
  const profile = await loadTabPageProfile();

  return (
    <main
      id="main-content"
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-brand-black"
    >
      <ExperienceGivingPageClient initialProfile={profile} />
    </main>
  );
}
