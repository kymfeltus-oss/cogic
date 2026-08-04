"use client";

import { useState, type CSSProperties } from "react";
import MobileNativeHeader from "@/components/navigation/MobileNativeHeader";
import { MOBILE_ARTBOARD_TAB_CHROME } from "@/lib/navigation/mobile-artboard-chrome";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

type MobileArtboardTabHeaderProps = {
  profile: AttendeeProfileSnapshot;
  onProfileChange?: (profile: AttendeeProfileSnapshot) => void;
  backVariant?: "back" | "close";
  showBack?: boolean;
  title?: string;
};

/** Uniform top row — masks baked PNG chrome, native back + profile + menu on every tab. */
export default function MobileArtboardTabHeader({
  profile,
  onProfileChange,
  backVariant = "back",
  showBack = true,
  title,
}: MobileArtboardTabHeaderProps) {
  const [localProfile, setLocalProfile] = useState(profile);
  const masks = MOBILE_ARTBOARD_TAB_CHROME.bakedMask;

  const handleProfileChange = (next: AttendeeProfileSnapshot) => {
    setLocalProfile(next);
    onProfileChange?.(next);
  };

  return (
    <>
      <div
        className="mobile-artboard-header-mask mobile-artboard-header-mask--back"
        aria-hidden="true"
        style={
          {
            "--mobile-artboard-header-mask-left": masks.back.left,
            "--mobile-artboard-header-mask-top": masks.back.top,
            "--mobile-artboard-header-mask-width": masks.back.width,
            "--mobile-artboard-header-mask-height": masks.back.height,
          } as CSSProperties
        }
      />
      <div
        className="mobile-artboard-header-mask mobile-artboard-header-mask--actions"
        aria-hidden="true"
        style={
          {
            "--mobile-artboard-header-mask-left": masks.actions.left,
            "--mobile-artboard-header-mask-top": masks.actions.top,
            "--mobile-artboard-header-mask-width": masks.actions.width,
            "--mobile-artboard-header-mask-height": masks.actions.height,
          } as CSSProperties
        }
      />

      <MobileNativeHeader
        title={title}
        profile={localProfile}
        onProfileChange={handleProfileChange}
        leading={showBack ? backVariant : "none"}
      />
    </>
  );
}
