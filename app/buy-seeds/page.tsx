import { Suspense } from "react";
import BuySeedsPageClient from "@/components/buy-seeds/BuySeedsPageClient";
import { loadTabPageProfile } from "@/lib/experience/load-tab-page-profile";

export const dynamic = "force-dynamic";

export default async function BuySeedsPage() {
  const profile = await loadTabPageProfile();

  return (
    <main
      id="main-content"
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-brand-black"
      aria-label="Buy Seeds"
    >
      <Suspense fallback={null}>
        <BuySeedsPageClient initialProfile={profile} />
      </Suspense>
    </main>
  );
}
