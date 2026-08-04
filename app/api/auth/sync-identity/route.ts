import { NextRequest, NextResponse } from "next/server";
import { syncUserProfileIdentity } from "@/lib/auth/sync-attendee-profile";
import { createRequestBoundSupabase } from "@/lib/checkout/server";

export async function POST(request: NextRequest) {
  const { client, withSessionCookies } = createRequestBoundSupabase(request);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncUserProfileIdentity(user);

  return withSessionCookies(NextResponse.json({ success: true }));
}
