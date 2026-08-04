"use client";

import AttendeeStreamPlayer from "@/components/experience/live/AttendeeStreamPlayer";
import FloatingLiveReactions from "@/components/experience/live/FloatingLiveReactions";

/**
 * Ian Craig live video stage — HLS playback with loading/recovery overlay.
 * Uses AttendeeStreamPlayer (manifest + hls.js) instead of a static placeholder.
 */
export default function IanCraigLiveVideoStage() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-brand-black">
      <div className="absolute inset-0">
        <AttendeeStreamPlayer enabled showPaywall={false} embedded />
      </div>

      <FloatingLiveReactions />

      <div
        className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-black/75 via-transparent to-black/45"
        aria-hidden="true"
      />
    </div>
  );
}
