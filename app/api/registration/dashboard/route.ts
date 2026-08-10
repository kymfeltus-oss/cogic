import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { loadMyRegistrationDashboard } from "@/lib/registration/load-my-registration";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUserFromSession();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const dashboard = await loadMyRegistrationDashboard(user.id);

  // Never trust/accept client status/amounts — this response is read-only server state.
  return NextResponse.json(
    {
      ...dashboard,
      // Hardened: never echo secrets if any slip into nested payloads.
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(request: Request) {
  const user = await getUserFromSession();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (body?.status || body?.amountCents != null || body?.amount_cents != null || body?.confirmed === true) {
    return NextResponse.json(
      { error: "Client cannot override registration status, confirmation, or amounts." },
      { status: 400 },
    );
  }

  // Draft field edits continue through the existing registration experience flow.
  return NextResponse.json(
    {
      error: "Edit registration information in the registration flow.",
      redirectTo: "/register",
    },
    { status: 409 },
  );
}
