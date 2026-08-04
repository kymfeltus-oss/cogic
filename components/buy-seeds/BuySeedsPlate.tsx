"use client";

import type { CSSProperties } from "react";
import BuySeedsOverlay from "@/components/buy-seeds/BuySeedsOverlay";
import MobileArtboardTabHeader from "@/components/navigation/MobileArtboardTabHeader";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import {
  MOBILE_ARTBOARD_ART_FIT,
  MOBILE_ARTBOARD_TAB_SHELL,
  MOBILE_ARTBOARD_TAB_STAGE,
  mobileArtboardStageStyle,
} from "@/lib/responsive";
import {
  BUY_SEEDS_ARTBOARD_WIDTH_SCALE,
  BUY_SEEDS_ASSETS,
  BUY_SEEDS_MOBILE_ART_NATIVE,
  type SeedPackageId,
} from "@/lib/seeds/assets";

type BuySeedsPlateProps = {
  profile: AttendeeProfileSnapshot;
  onProfileChange: (profile: AttendeeProfileSnapshot) => void;
  selectedPackageId: SeedPackageId;
  isSubmitting: boolean;
  activePackageId: SeedPackageId | null;
  errorMessage: string | null;
  onSelectPackage: (packageId: SeedPackageId) => void;
  onContinue: () => void;
};

export default function BuySeedsPlate({
  profile,
  onProfileChange,
  selectedPackageId,
  isSubmitting,
  activePackageId,
  errorMessage,
  onSelectPackage,
  onContinue,
}: BuySeedsPlateProps) {
  return (
    <div className={`buy-seeds-page ${MOBILE_ARTBOARD_TAB_SHELL}`}>
      <div
        className={`buy-seeds-page__stage ${MOBILE_ARTBOARD_TAB_STAGE}`}
        style={
          {
            ...mobileArtboardStageStyle(),
            "--buy-seeds-artboard-width-scale": BUY_SEEDS_ARTBOARD_WIDTH_SCALE,
          } as CSSProperties
        }
      >
        <div className={MOBILE_ARTBOARD_ART_FIT}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BUY_SEEDS_ASSETS.mobileBackground}
            alt=""
            width={BUY_SEEDS_MOBILE_ART_NATIVE.width}
            height={BUY_SEEDS_MOBILE_ART_NATIVE.height}
            className="buy-seeds-page__bg buy-seeds-page__bg--base"
            loading="eager"
            decoding="async"
            draggable={false}
          />

          <MobileArtboardTabHeader
            title="Buy Seeds"
            profile={profile}
            onProfileChange={onProfileChange}
          />

          <BuySeedsOverlay
            selectedPackageId={selectedPackageId}
            isSubmitting={isSubmitting}
            activePackageId={activePackageId}
            errorMessage={errorMessage}
            onSelectPackage={onSelectPackage}
            onContinue={onContinue}
          />
        </div>
      </div>
    </div>
  );
}
