import { redirect } from "next/navigation";
import LiveStreamUnavailable from "@/components/live/LiveStreamUnavailable";
import { isKnownAttendeeStreamId } from "@/lib/live/attendee-live-honesty";
import { attendeeStatusMessage } from "@/lib/live/attendee-live-honesty";

export const dynamic = "force-dynamic";

type LiveStreamPageProps = {
  params: Promise<{ streamId: string }>;
};

/**
 * Legacy attendee stream deep-links resolve to the Live Hub at `/live`.
 * Unknown IDs stay honest unavailable — no isolated player shell.
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

  redirect("/live");
}
