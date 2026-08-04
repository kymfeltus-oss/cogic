import { requireOwnerUser } from "@/lib/owner/auth";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";
import { DEFAULT_AUDIO_LEVEL_TRACKS, type OwnerAudioTelemetry } from "@/lib/owner/audio-contracts";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const telemetry: OwnerAudioTelemetry = {
    tracks: DEFAULT_AUDIO_LEVEL_TRACKS,
    capturedAt: new Date().toISOString(),
    mediaNodeStatus: "offline",
    mediaNodeDetail: "Audio telemetry service is not connected.",
  };

  return ownerJsonResponse({ ok: true, success: true, telemetry });
}
