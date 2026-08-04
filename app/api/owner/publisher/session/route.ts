import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import {
  clearOwnerPublisherSession,
  createOwnerPublisherSession,
} from "@/lib/owner/publisher-session";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const admin = getSupabaseAdmin();
    const { session, error } = await createOwnerPublisherSession(admin, auth.email);
    if (error || !session) {
      return ownerJsonResponse({ error: error ?? "Unable to create publisher session." }, 500);
    }
    return ownerJsonResponse({ session });
  } catch (error) {
    console.error("[owner/publisher/session] POST failed:", error);
    return ownerJsonResponse({ error: "Publisher session failed." }, 500);
  }
}

export async function DELETE() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const admin = getSupabaseAdmin();
    const { error } = await clearOwnerPublisherSession(admin, auth.email);
    if (error) {
      return ownerJsonResponse({ error }, 500);
    }
    return ownerJsonResponse({ ok: true });
  } catch (error) {
    console.error("[owner/publisher/session] DELETE failed:", error);
    return ownerJsonResponse({ error: "Unable to clear publisher session." }, 500);
  }
}
