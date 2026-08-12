import { NextResponse } from "next/server";
import { resolveServerOrgContext } from "@/lib/org/session-org-context";

/**
 * Fail-closed org context for the authenticated session.
 * Never accepts client-supplied churchId/role; returns session-derived values only.
 */
export async function GET(request: Request) {
  const context = await resolveServerOrgContext(request);
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json(
    {
      userId: context.userId,
      email: context.email,
      churchId: context.churchId,
      churchName: context.churchName,
      role: context.role,
      isPlatformOwner: context.isPlatformOwner,
      canCreateGroupRequest: Boolean(
        context.churchId && (context.role === "Pastor" || context.role === "Overseer"),
      ),
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      },
    },
  );
}
