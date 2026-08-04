import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { runOwnerEndBroadcast } from "@/lib/owner/broadcast-mutations";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const admin = getSupabaseAdmin();
    const result = await runOwnerEndBroadcast(admin, auth.email);
    return ownerJsonResponse(
      { ok: result.ok, snapshot: result.snapshot, message: result.message },
      result.ok ? 200 : 409,
    );
  } catch (error) {
    console.error("[owner/broadcast/end] POST failed:", error);
    return ownerJsonResponse({ error: "End broadcast failed." }, 500);
  }
}
