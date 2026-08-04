import { NextRequest, NextResponse } from "next/server";
import { CREATE_ACCOUNT_MIN_PASSWORD_LENGTH } from "@/lib/auth/create-account-validation";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client";

type ResetPasswordBody = {
  password?: string;
  confirmPassword?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResetPasswordBody;
    const password = body.password ?? "";
    const confirmPassword = body.confirmPassword ?? password;

    if (password.length < CREATE_ACCOUNT_MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `Password must be at least ${CREATE_ACCOUNT_MIN_PASSWORD_LENGTH} characters.`,
        },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const { supabase, getResponse } = createRouteHandlerSupabaseClient(
      request,
      () => NextResponse.json({ success: true }),
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Reset link expired or invalid. Request a new password reset email.",
        },
        { status: 401 },
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message ?? "Unable to update password." },
        { status: 400 },
      );
    }

    return getResponse();
  } catch (error) {
    console.error("[AUTH_RESET_PASSWORD_ERR]:", error);
    return NextResponse.json(
      { error: "Unable to reset password. Please try again." },
      { status: 500 },
    );
  }
}
