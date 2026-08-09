import { NextResponse } from "next/server";
import { parseAccessContext } from "@/lib/access";
import { getUserFromSession } from "@/lib/auth/session";
import { resolveIntroEnterDestination } from "@/lib/experience/intro-destination";
import { getActiveRegistrationForUser } from "@/lib/registration/repository";

export const dynamic = "force-dynamic";

/** Authoritative Enter destination for `/intro` (session + registration). */
export async function GET() {
  const user = await getUserFromSession();
  if (!user) {
    const result = resolveIntroEnterDestination({
      userId: null,
      isGuest: false,
      hasActiveRegistration: false,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const access = parseAccessContext(user);
  let hasActiveRegistration = false;
  if (!access.isGuest) {
    try {
      const registration = await getActiveRegistrationForUser({ userId: user.id });
      hasActiveRegistration = Boolean(registration);
    } catch {
      hasActiveRegistration = false;
    }
  }

  const result = resolveIntroEnterDestination({
    userId: access.userId,
    isGuest: access.isGuest,
    hasActiveRegistration,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
