import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const route = read("app/api/auth/otp/route.ts");
const ui = read("components/auth/AccountOtpVerificationClient.tsx");
const createAccount = read("components/auth/CreateAccountClient.tsx");
const routing = read("lib/auth/routing.ts");
const rateLimit = read("lib/rate-limit/index.ts");

test("email OTP request validates input and delegates delivery to Supabase signup resend", () => {
  assert.match(route, /isValidEmail\(email\)/);
  assert.match(route, /supabase\.auth\.resend\(\{ type: "signup", email/);
  assert.match(route, /emailRedirectTo/);
  assert.doesNotMatch(route, /token:\s*token/);
  assert.doesNotMatch(route, /console\.log/);
});

test("phone OTP normalizes to E.164 and uses the authenticated Supabase phone-change lifecycle", () => {
  assert.match(route, /normalizePhoneDigits/);
  assert.match(route, /const phone = `\+1\$\{phoneDigits\}`/);
  assert.match(route, /supabase\.auth\.updateUser\(\{ phone/);
  assert.match(route, /type: "phone_change"/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
});

test("request and verification phases are rate limited and expose safe error states", () => {
  assert.match(route, /enforceOtpRateLimit/);
  assert.match(route, /Too many verification requests\. Please wait before trying again\./);
  assert.match(route, /That verification code has expired\. Request a new code\./);
  assert.match(route, /That verification code is incorrect\./);
  assert.match(route, /We couldn't send your verification code right now/);
  assert.match(rateLimit, /OTP_REQUEST_LIMIT = 5/);
  assert.match(rateLimit, /OTP_VERIFY_LIMIT = 8/);
});

test("only Supabase verification can establish state, with no application OTP table or consent mutation", () => {
  assert.match(route, /supabase\.auth\.verifyOtp/);
  assert.match(route, /syncUserProfileIdentity\(data\.user\)/);
  assert.doesNotMatch(route, /email_verified|phone_verified|email_opt_in|sms_opt_in/);
  assert.doesNotMatch(route, /insert\(|from\(".*otp/i);
});

test("signup routes unconfirmed accounts into the mobile verification journey and preserves next", () => {
  assert.match(createAccount, /buildVerifyAccountUrl\(payload\.email, nextPath\)/);
  assert.match(routing, /VERIFY_ACCOUNT_PATH = "\/verify-account"/);
  assert.match(routing, /params\.set\("next", resolveAttendeeDestination/);
  assert.match(ui, /inputMode="numeric"/);
  assert.match(ui, /autoComplete="one-time-code"/);
  assert.match(ui, /min-h-11 w-full/);
});
