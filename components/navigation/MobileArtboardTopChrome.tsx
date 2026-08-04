"use client";

import type { CSSProperties } from "react";
import AwakeningMenuButton from "@/components/AwakeningMenuButton";
import ProfileOrbEditor from "@/components/profile/ProfileOrbEditor";
import {
  MOBILE_ARTBOARD_TAB_CHROME,
  type MobileArtboardChromeRect,
} from "@/lib/navigation/mobile-artboard-chrome";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

type MobileArtboardTopChromeProps = {
  profile: AttendeeProfileSnapshot;
  onProfileChange: (profile: AttendeeProfileSnapshot) => void;
  actionsSlot?: MobileArtboardChromeRect;
  profileOrbSize?: number;
};

function slotStyle(slot: MobileArtboardChromeRect): CSSProperties {
  return {
    left: slot.left,
    top: slot.top,
    width: slot.width,
    height: slot.height,
  };
}

/** Profile orb + hamburger menu aligned to mobile artboard header (Music / Buy Seeds pattern). */
export default function MobileArtboardTopChrome({
  profile,
  onProfileChange,
  actionsSlot = MOBILE_ARTBOARD_TAB_CHROME.actions,
  profileOrbSize = MOBILE_ARTBOARD_TAB_CHROME.profileOrbSize,
}: MobileArtboardTopChromeProps) {
  return (
    <header
      className="mobile-artboard-top-chrome pointer-events-none"
      style={slotStyle(actionsSlot)}
      aria-label="Page header actions"
    >
      <div className="mobile-artboard-top-chrome__actions pointer-events-auto">
        <ProfileOrbEditor
          profile={profile}
          onProfileChange={onProfileChange}
          size={profileOrbSize}
        />
        <AwakeningMenuButton className="mobile-artboard-top-chrome__menu shrink-0" />
      </div>
    </header>
  );
}
