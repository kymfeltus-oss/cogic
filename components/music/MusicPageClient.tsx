"use client";

import { useState, type CSSProperties } from "react";
import MusicOverlay from "@/components/music/MusicOverlay";
import MobileArtboardTabHeader from "@/components/navigation/MobileArtboardTabHeader";
import { MUSIC_ASSETS, MUSIC_MOBILE_ART_NATIVE } from "@/lib/music/assets";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import {
  MOBILE_ARTBOARD_ART_FIT,
  MOBILE_ARTBOARD_TAB_SHELL,
  MOBILE_ARTBOARD_TAB_STAGE,
  mobileArtboardStageStyle,
} from "@/lib/responsive";

type MusicPageClientProps = {
  initialProfile: AttendeeProfileSnapshot;
};

export default function MusicPageClient({ initialProfile }: MusicPageClientProps) {
  const [profile, setProfile] = useState(initialProfile);

  return (
    <div className={`music-page ${MOBILE_ARTBOARD_TAB_SHELL}`}>
      <div
        className={`music-page__stage ${MOBILE_ARTBOARD_TAB_STAGE}`}
        style={mobileArtboardStageStyle({ native: MUSIC_MOBILE_ART_NATIVE }) as CSSProperties}
      >
        <div className={MOBILE_ARTBOARD_ART_FIT}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MUSIC_ASSETS.mobileBackground}
            alt="COGIC LIVE Music"
            width={MUSIC_MOBILE_ART_NATIVE.width}
            height={MUSIC_MOBILE_ART_NATIVE.height}
            className="music-page__bg"
            loading="eager"
            decoding="async"
            draggable={false}
          />
          <MobileArtboardTabHeader title="Music" profile={profile} onProfileChange={setProfile} />
          <MusicOverlay />
        </div>
      </div>
    </div>
  );
}
