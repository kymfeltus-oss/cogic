import { requireOwnerUser } from "@/lib/owner/auth";
import { buildOwnerBroadcastSnapshot } from "@/lib/owner/build-broadcast-snapshot";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const { snapshot, error } = await buildOwnerBroadcastSnapshot();
    if (error) {
      console.error("[owner/broadcast] snapshot load warning:", error);
    }
    return ownerJsonResponse({ snapshot, warning: error });
  } catch (error) {
    console.error("[owner/broadcast] GET failed:", error);
    return ownerJsonResponse({ error: "Unable to load owner broadcast snapshot." }, 500);
  }
}
