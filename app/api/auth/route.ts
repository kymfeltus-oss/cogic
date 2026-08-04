import { NextRequest, NextResponse } from "next/server";
import { generateGuestEmail, generateGuestPassword } from "@/lib/access";
import {
  CREATE_ACCOUNT_MIN_PASSWORD_LENGTH,
} from "@/lib/auth/create-account-validation";
import {
  DEFAULT_ATTENDEE_NEXT,
  resolveAttendeeDestination,
} from "@/lib/auth/routing";
import { buildAuthCallbackUrl } from "@/lib/auth/server";
import { isValidUsStateCode } from "@/lib/auth/us-states";
import { syncUserProfileIdentity } from "@/lib/auth/sync-attendee-profile";
import { normalizePhoneDigits, isValidPhone } from "@/lib/auth/validation";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type AuthAction = "login" | "signup" | "guest";

type AuthRequestBody = {
  action?: AuthAction;
  email?: string;
  password?: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
  next?: string;
};

function normalizeNamePart(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function jsonResponse(payload: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(payload, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AuthRequestBody;
    const action = body.action;

    if (!action || !["signup", "login", "guest"].includes(action)) {
      return jsonResponse({ error: "Invalid auth action." }, 400);
    }

    const { supabase, getResponse } = createRouteHandlerSupabaseClient(
      request,
      () => jsonResponse({ success: true }),
    );

    if (action === "login") {
      const email = body.email?.trim().toLowerCase();
      const password = body.password;

      if (!email || !password || !isValidEmail(email)) {
        return jsonResponse(
          { error: "Valid email and password are required." },
          400,
        );
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        return jsonResponse(
          { error: error?.message ?? "Unable to sign in." },
          401,
        );
      }

      await syncUserProfileIdentity(data.user);

      return getResponse();
    }

    if (action === "signup") {
      const email = body.email?.trim().toLowerCase();
      const password = body.password;
      const confirmPassword = body.confirmPassword;
      const firstName = normalizeNamePart(body.firstName);
      const lastName = normalizeNamePart(body.lastName);
      const phone = normalizePhoneDigits(body.phone ?? "");
      const city = body.city?.trim() ?? "";
      const state = body.state?.trim().toUpperCase() ?? "";

      if (
        !email ||
        !password ||
        password.length < CREATE_ACCOUNT_MIN_PASSWORD_LENGTH ||
        !isValidEmail(email)
      ) {
        return jsonResponse(
          {
            error: `Valid email and a ${CREATE_ACCOUNT_MIN_PASSWORD_LENGTH}+ character password are required.`,
          },
          400,
        );
      }

      if (confirmPassword !== undefined && confirmPassword !== password) {
        return jsonResponse({ error: "Passwords do not match." }, 400);
      }

      if (!firstName || !lastName) {
        return jsonResponse(
          { error: "First and last name are required to create an account." },
          400,
        );
      }

      if (phone && !isValidPhone(phone)) {
        return jsonResponse(
          { error: "Enter a valid 10-digit US phone number." },
          400,
        );
      }

      if (!city) {
        return jsonResponse({ error: "City is required." }, 400);
      }

      if (!state || !isValidUsStateCode(state)) {
        return jsonResponse({ error: "A valid US state is required." }, 400);
      }

      const signupNext = resolveAttendeeDestination(
        body.next ?? DEFAULT_ATTENDEE_NEXT,
      );
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            is_guest: false,
            first_name: firstName,
            last_name: lastName,
            phone,
            city,
            state,
          },
          emailRedirectTo: buildAuthCallbackUrl(signupNext, request),
        },
      });

      if (error || !data.user) {
        return jsonResponse(
          { error: error?.message ?? "Unable to create account." },
          400,
        );
      }

      let activeUser = data.user;

      if (!data.session) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError) {
          return jsonResponse(
            {
              error:
                "Account created. Confirm your email or retry sign-in if confirmation is disabled.",
            },
            202,
          );
        }

        activeUser = signInData.user ?? activeUser;
      }

      if (activeUser) {
        await syncUserProfileIdentity(activeUser);
      }

      return getResponse();
    }

    const guestEmail = generateGuestEmail();
    const guestPassword = generateGuestPassword();
    const contactEmail = body.email?.trim().toLowerCase();
    const contactPhone = body.phone?.trim();
    const admin = getSupabaseAdmin();

    const guestMetadata: Record<string, unknown> = { is_guest: true };
    if (contactEmail && isValidEmail(contactEmail)) {
      guestMetadata.contact_email = contactEmail;
    }
    if (contactPhone) {
      guestMetadata.contact_phone = contactPhone;
    }

    const { data: createdUser, error: createError } =
      await admin.auth.admin.createUser({
        email: guestEmail,
        password: guestPassword,
        email_confirm: true,
        user_metadata: guestMetadata,
      });

    if (createError || !createdUser.user) {
      return jsonResponse(
        { error: createError?.message ?? "Unable to create guest session." },
        500,
      );
    }

    const { data: guestSession, error: guestSignInError } =
      await supabase.auth.signInWithPassword({
        email: guestEmail,
        password: guestPassword,
      });

    if (guestSignInError || !guestSession.user) {
      return jsonResponse(
        { error: guestSignInError?.message ?? "Unable to start guest session." },
        500,
      );
    }

    return getResponse();
  } catch (error) {
    console.error("Auth route error:", error);
    const message =
      error instanceof Error ? error.message : "Authentication failed.";
    return jsonResponse({ error: message }, 500);
  }
}
