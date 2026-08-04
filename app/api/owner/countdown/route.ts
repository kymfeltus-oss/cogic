import { requireOwnerUser } from "@/lib/owner/auth";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";
import { loadShowSetupState, saveShowSetupState } from "@/lib/owner/show-setup-state";

export const dynamic = "force-dynamic";

function parseOffsetSeconds(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  return Math.max(-86_400, Math.min(86_400, Math.trunc(parsed)));
}

export async function PATCH(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const body = (await request.json()) as { offsetSeconds?: unknown };
    const offsetSeconds = parseOffsetSeconds(body.offsetSeconds);
    if (offsetSeconds === null) {
      return ownerJsonResponse({ error: "Invalid body. Expected numeric offsetSeconds." }, 400);
    }

    const current = await loadShowSetupState();
    const currentTime = new Date(current.targetDateTime).getTime();
    if (!Number.isFinite(currentTime)) {
      return ownerJsonResponse({ error: "Current countdown schedule is invalid." }, 409);
    }

    const targetDateTime = new Date(currentTime + offsetSeconds * 1_000).toISOString();
    const state = await saveShowSetupState({ ...current, targetDateTime }, auth.email);
    const minutes = Math.abs(offsetSeconds / 60);
    const direction = offsetSeconds >= 0 ? "advanced" : "reduced";
    const minuteLabel = Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
    return ownerJsonResponse({
      ok: true,
      state,
      message: `Countdown ${direction} by ${minuteLabel} minute${minutes === 1 ? "" : "s"}.`,
    });
  } catch (error) {
    console.error("[owner/countdown] PATCH failed:", error);
    return ownerJsonResponse(
      { error: error instanceof Error ? error.message : "Countdown adjustment failed." },
      500,
    );
  }
}
