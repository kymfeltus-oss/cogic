import { requireOwnerUser } from "@/lib/owner/auth";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";
import { loadShowSetupState, saveShowSetupState } from "@/lib/owner/show-setup-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const state = await loadShowSetupState();
    return ownerJsonResponse({ ok: true, state });
  } catch (error) {
    console.error("[owner/show-setup] GET failed:", error);
    return ownerJsonResponse({ error: "Unable to load show setup." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const state = await saveShowSetupState(body, auth.email);
    return ownerJsonResponse({ ok: true, state, message: "Show setup saved." });
  } catch (error) {
    console.error("[owner/show-setup] POST failed:", error);
    return ownerJsonResponse(
      { error: error instanceof Error ? error.message : "Unable to save show setup." },
      400,
    );
  }
}
