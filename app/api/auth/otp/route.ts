import { NextRequest, NextResponse } from "next/server";

import { buildAuthCallbackUrl } from "@/lib/auth/server";
import { syncUserProfileIdentity } from "@/lib/auth/sync-attendee-profile";
import { DEFAULT_ATTENDEE_NEXT, resolveAttendeeDestination } from "@/lib/auth/routing";
import { isValidEmail, isValidPhone, normalizePhoneDigits } from "@/lib/auth/validation";
import { enforceOtpRateLimit, rateLimitResponseHeaders } from "@/lib/rate-limit";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client";

function safeOtpError(message: string | undefined): string {
  const value = message?.toLowerCase() ?? "";
  if (/rate limit|too many|over.*limit/.test(value)) return "Too many verification requests. Please wait before trying again.";
  if (/expired|expire/.test(value)) return "That verification code has expired. Request a new code.";
  if (/token.*invalid|otp.*invalid|invalid.*token|verification.*failed/.test(value)) return "That verification code is incorrect.";
  if (/sms|phone.*provider|unable to send|mailer|email.*provider/.test(value)) return "We couldn't send your verification code right now. Please try again shortly.";
  return "We couldn't verify that code. Request a new code and try again.";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const channel = body?.channel;
  const action = body?.action;
  if ((channel !== "email" && channel !== "phone") || (action !== "send" && action !== "verify")) {
    return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
  }
  const { supabase, getResponse } = createRouteHandlerSupabaseClient(request, () => NextResponse.json({ ok: true }));
  const nextPath = resolveAttendeeDestination(typeof body?.next === "string" ? body.next : DEFAULT_ATTENDEE_NEXT);

  if (channel === "email") {
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const limit = await enforceOtpRateLimit(request, email, action === "send" ? "request" : "verify");
    if (!limit.allowed) return NextResponse.json({ error: "Too many verification requests. Please wait before trying again." }, { status: 429, headers: rateLimitResponseHeaders(limit) });
    if (action === "send") {
      const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: buildAuthCallbackUrl(nextPath, request) } });
      if (error) return NextResponse.json({ error: safeOtpError(error.message) }, { status: 400 });
      return NextResponse.json({ ok: true, sent: true });
    }
    const token = typeof body?.token === "string" ? body.token.replace(/\s/g, "") : "";
    if (!/^\d{6,8}$/.test(token)) return NextResponse.json({ error: "Enter the verification code from your email." }, { status: 400 });
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
    if (error || !data.user) return NextResponse.json({ error: safeOtpError(error?.message) }, { status: 400 });
    await syncUserProfileIdentity(data.user);
    const response = getResponse();
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Sign in to verify your mobile phone number." }, { status: 401 });
  const phoneDigits = typeof body?.phone === "string" ? normalizePhoneDigits(body.phone) : "";
  if (!isValidPhone(phoneDigits)) return NextResponse.json({ error: "Enter a valid mobile phone number." }, { status: 400 });
  const phone = `+1${phoneDigits}`;
  const limit = await enforceOtpRateLimit(request, userData.user.id, action === "send" ? "request" : "verify");
  if (!limit.allowed) return NextResponse.json({ error: "Too many verification requests. Please wait before trying again." }, { status: 429, headers: rateLimitResponseHeaders(limit) });
  if (action === "send") {
    const { error } = await supabase.auth.updateUser({ phone, data: { ...userData.user.user_metadata, phone } });
    if (error) return NextResponse.json({ error: safeOtpError(error.message) }, { status: 400 });
    return NextResponse.json({ ok: true, sent: true });
  }
  const token = typeof body?.token === "string" ? body.token.replace(/\s/g, "") : "";
  if (!/^\d{6,8}$/.test(token)) return NextResponse.json({ error: "Enter the verification code from your phone." }, { status: 400 });
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "phone_change" });
  if (error || !data.user) return NextResponse.json({ error: safeOtpError(error?.message) }, { status: 400 });
  await syncUserProfileIdentity(data.user);
  const response = getResponse();
  response.headers.set("Cache-Control", "no-store");
  return response;
}
