import { requireOwnerUser } from "@/lib/owner/auth";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";
import { callVmixFunction, fetchVmixSnapshot } from "@/lib/owner/vmix/client";
import { isAllowedVmixFunction } from "@/lib/owner/vmix/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const body = (await request.json()) as { function?: string; query?: Record<string, string> };
    const functionName = body.function?.trim() ?? "";

    if (!functionName || !isAllowedVmixFunction(functionName)) {
      return ownerJsonResponse(
        {
          error:
            "Invalid function. Allowed: StartStreaming, StopStreaming, StartRecording, StopRecording, Cut, Fade.",
        },
        400,
      );
    }

    const result = await callVmixFunction(functionName, body.query ?? {});
    const vmix = await fetchVmixSnapshot();

    return ownerJsonResponse({
      ok: result.ok,
      message: result.message,
      vmix,
    }, result.ok ? 200 : 502);
  } catch (error) {
    console.error("[owner/vmix/command] POST failed:", error);
    return ownerJsonResponse({ error: "vMix command failed." }, 500);
  }
}
