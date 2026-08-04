import { NextRequest, NextResponse } from "next/server";
import { buildPasswordRecoveryRedirectUrl } from "@/lib/auth/password-reset";
import {
  DEFAULT_ATTENDEE_NEXT,
  resolveAttendeeDestination,
  sanitizeNextPath,
} from "@/lib/auth/routing";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; next?: string };
    const email = body.email?.trim().toLowerCase();
    const attendeeNext = resolveAttendeeDestination(
      sanitizeNextPath(body.next ?? null, DEFAULT_ATTENDEE_NEXT),
    );

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    const { supabase, getResponse } = createRouteHandlerSupabaseClient(
      request,
      () => NextResponse.json({ success: true }),
    );

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildPasswordRecoveryRedirectUrl(request, attendeeNext),
    });

    if (error) {
      console.error("[AUTH_FORGOT_PASSWORD_ERR]:", error.message);
    }

    // Always succeed — prevents account email enumeration.
    return getResponse();
  } catch (error) {
    console.error("[AUTH_FORGOT_PASSWORD_ERR]:", error);
    return NextResponse.json(
      { error: "Unable to send reset email. Please try again." },
      { status: 500 },
    );
  }
}
