import { requireOwnerUser } from "@/lib/owner/auth";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";
import { fetchVmixSnapshot } from "@/lib/owner/vmix/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const vmix = await fetchVmixSnapshot();
    return ownerJsonResponse({ vmix });
  } catch (error) {
    console.error("[owner/vmix/status] GET failed:", error);
    return ownerJsonResponse({ error: "Unable to load vMix status." }, 500);
  }
}
