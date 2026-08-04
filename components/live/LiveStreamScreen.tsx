"use client";

import LiveDataLoader from "@/components/experience/live/LiveDataLoader";
import LiveStreamUnavailable from "@/components/live/LiveStreamUnavailable";
import {
  attendeeStatusMessage,
  isKnownAttendeeStreamId,
} from "@/lib/live/attendee-live-honesty";

type LiveStreamScreenProps = {
  streamId: string;
};

/**
 * Legacy social-shell entry. Production attendee playback uses LiveExperienceClient
 * via LiveDataLoader — no mock viewers/chat.
 */
export default function LiveStreamScreen({ streamId }: LiveStreamScreenProps) {
  if (!isKnownAttendeeStreamId(streamId)) {
    return (
      <LiveStreamUnavailable
        title="Stream not found"
        message={attendeeStatusMessage("unavailable")}
      />
    );
  }

  return <LiveDataLoader />;
}
