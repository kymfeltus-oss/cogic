import { Suspense } from "react";
import EmailGatePageClient from "@/components/email-gate/EmailGatePageClient";
import LightweightLiveLoading from "@/components/live/LightweightLiveLoading";

export const dynamic = "force-dynamic";

export default function EmailGatePage() {
  return (
    <main
      id="main-content"
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-brand-black"
      aria-label="Entry hub"
    >
      <Suspense fallback={<LightweightLiveLoading />}>
        <EmailGatePageClient />
      </Suspense>
    </main>
  );
}
