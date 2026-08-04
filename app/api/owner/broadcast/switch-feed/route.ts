import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { parseSwitchFeedBody, runOwnerSwitchFeed } from "@/lib/owner/broadcast-mutations";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const body = parseSwitchFeedBody(await request.json());
    if (!body) {
      return ownerJsonResponse(
        { error: "Invalid body. Expected { source: primary | backup }." },
        400,
      );
    }

    const admin = getSupabaseAdmin();
    const result = await runOwnerSwitchFeed(admin, body, auth.email);
    return ownerJsonResponse(
      { ok: result.ok, snapshot: result.snapshot, message: result.message },
      result.ok ? 200 : 409,
    );
  } catch (error) {
    console.error("[owner/broadcast/switch-feed] POST failed:", error);
    return ownerJsonResponse({ error: "Feed switch failed." }, 500);
  }
}
