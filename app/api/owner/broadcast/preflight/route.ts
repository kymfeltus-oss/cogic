import { requireOwnerUser } from "@/lib/owner/auth";
import { runOwnerPreflight } from "@/lib/owner/broadcast-mutations";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";
import type { PublishMode } from "@/lib/owner/contracts";

export const dynamic = "force-dynamic";

function parseMode(raw: string | null): PublishMode | undefined {
  if (
    raw === "external_hls" ||
    raw === "rtmp_encoder" ||
    raw === "browser_camera"
  ) {
    return raw;
  }
  return undefined;
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    let mode: PublishMode | undefined;
    try {
      const body = (await request.json()) as { mode?: string };
      mode = parseMode(body.mode ?? null);
    } catch {
      mode = undefined;
    }

    const { snapshot, blocked } = await runOwnerPreflight(mode);
    return ownerJsonResponse({ snapshot, blocked });
  } catch (error) {
    console.error("[owner/broadcast/preflight] POST failed:", error);
    return ownerJsonResponse({ error: "Preflight failed." }, 500);
  }
}
