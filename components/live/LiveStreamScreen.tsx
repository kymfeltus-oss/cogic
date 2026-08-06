"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LiveStreamUnavailable from "@/components/live/LiveStreamUnavailable";
import {
  attendeeStatusMessage,
  isKnownAttendeeStreamId,
} from "@/lib/live/attendee-live-honesty";

type LiveStreamScreenProps = {
  streamId: string;
};

/**
 * Legacy social-shell entry — known streams route into the Live Hub at `/live`.
 */
export default function LiveStreamScreen({ streamId }: LiveStreamScreenProps) {
  const router = useRouter();
  const known = isKnownAttendeeStreamId(streamId);

  useEffect(() => {
    if (known) {
      router.replace("/live");
    }
  }, [known, router]);

  if (!known) {
    return (
      <LiveStreamUnavailable
        title="Stream not found"
        message={attendeeStatusMessage("unavailable")}
      />
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#04070f] px-6 text-center text-white/70">
      <p className="font-body text-sm">Opening COGIC LIVE Hub…</p>
    </div>
  );
}
