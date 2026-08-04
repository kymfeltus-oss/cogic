import LiveDataLoader from "@/components/experience/live/LiveDataLoader";
import LiveStreamUnavailable from "@/components/live/LiveStreamUnavailable";
import { isKnownAttendeeStreamId } from "@/lib/live/attendee-live-honesty";
import { attendeeStatusMessage } from "@/lib/live/attendee-live-honesty";

export const dynamic = "force-dynamic";

type LiveStreamPageProps = {
  params: Promise<{ streamId: string }>;
};

/**
 * Attendee stream deep-link. Known IDs resolve to the singleton live broadcast
 * via LiveExperienceClient. Unknown IDs show an honest unavailable state.
 */
export default async function LiveStreamPage({ params }: LiveStreamPageProps) {
  const { streamId } = await params;

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
