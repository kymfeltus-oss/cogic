"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import BuySeedsPlate from "@/components/buy-seeds/BuySeedsPlate";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import { CONTENT_WITH_NAV } from "@/lib/responsive";
import {
  BUY_SEEDS_DEFAULT_PACKAGE_ID,
  type SeedPackageId,
} from "@/lib/seeds/assets";
import { useSeedCheckout } from "@/lib/useSeedCheckout";

type BuySeedsPageContentProps = {
  initialProfile: AttendeeProfileSnapshot;
};

function BuySeedsPageContent({ initialProfile }: BuySeedsPageContentProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const successParam = searchParams.get("success") === "true";

  const [selectedPackageId, setSelectedPackageId] =
    useState<SeedPackageId>(BUY_SEEDS_DEFAULT_PACKAGE_ID);
  const [showThankYou, setShowThankYou] = useState(successParam);
  const [profile, setProfile] = useState(initialProfile);

  const { isSubmitting, errorMessage, activePackageId, startCheckout, clearError } =
    useSeedCheckout();

  useEffect(() => {
    if (!successParam) return;
    window.history.replaceState({}, "", pathname);
  }, [successParam, pathname]);

  const handleSelectPackage = useCallback(
    (packageId: SeedPackageId) => {
      setSelectedPackageId(packageId);
      clearError();
    },
    [clearError],
  );

  const handleContinue = useCallback(() => {
    void startCheckout(selectedPackageId);
  }, [selectedPackageId, startCheckout]);

  return (
    <>
      <section
        className={`${CONTENT_WITH_NAV} flex min-h-0 w-full flex-1 flex-col overflow-hidden text-white`}
        aria-label="Buy Vital Seeds"
      >
        <BuySeedsPlate
          profile={profile}
          onProfileChange={setProfile}
          selectedPackageId={selectedPackageId}
          isSubmitting={isSubmitting}
          activePackageId={activePackageId}
          errorMessage={errorMessage}
          onSelectPackage={handleSelectPackage}
          onContinue={handleContinue}
        />
      </section>

      <AnimatePresence>
        {showThankYou ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
            onClick={() => setShowThankYou(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="mx-auto w-full max-w-2xl rounded-3xl border border-brand-blue/50 bg-brand-panel p-8 text-center shadow-[0_0_40px_rgba(0,168,255,0.35)]"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-brand-blue">
                Seeds Credited
              </p>
              <h2 className="mt-4 font-headline text-xl uppercase tracking-widest text-white">
                Thank You
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-brand-muted">
                Your Vital Seeds are ready for the live room. Shower the stage when the concert goes
                live.
              </p>
              <button
                type="button"
                onClick={() => setShowThankYou(false)}
                className="touch-target mt-8 w-full rounded-2xl border border-brand-blue bg-brand-blue/10 px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:bg-brand-blue/20"
              >
                Continue
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

type BuySeedsPageClientProps = {
  initialProfile: AttendeeProfileSnapshot;
};

export default function BuySeedsPageClient({ initialProfile }: BuySeedsPageClientProps) {
  return (
    <Suspense fallback={null}>
      <BuySeedsPageContent initialProfile={initialProfile} />
    </Suspense>
  );
}
