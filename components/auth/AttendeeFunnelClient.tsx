"use client";

import { useState } from "react";
import AttendeeAuthLoginPlate from "@/components/auth/AttendeeAuthLoginPlate";
import EmailGateShell, {
  gateFieldClass,
  PrimaryGateButton,
  ValidationHint,
} from "@/components/auth/EmailGateShell";
import OtpVerificationPlaceholder from "@/components/auth/OtpVerificationPlaceholder";
import { startOAuthSignIn, type OAuthProviderId } from "@/lib/auth/oauth-sign-in";
import {
  AUTH_NEXT_COOKIE,
  buildAttendeeGateUrl,
  buildCreateAccountUrl,
  buildForgotPasswordUrl,
  buildPersonaHubUrl,
  resolveAttendeeDestination,
} from "@/lib/auth/routing";
import {
  emailValidationState,
  formatPhoneDisplay,
  isValidEmail,
  isValidPhone,
  normalizePhoneDigits,
  phoneValidationState,
} from "@/lib/auth/validation";

type AttendeeTab = "login" | "guest";

type AttendeeFunnelClientProps = {
  nextPath: string;
  authError?: string | null;
  authErrorDescription?: string | null;
  emailConfirmed?: boolean;
};

export default function AttendeeFunnelClient({
  nextPath,
  authError = null,
  authErrorDescription = null,
  emailConfirmed = false,
}: AttendeeFunnelClientProps) {
  const destination = resolveAttendeeDestination(nextPath);
  const hubBackHref = buildPersonaHubUrl(destination);

  const [activeTab, setActiveTab] = useState<AttendeeTab>("login");
  const [guestStep, setGuestStep] = useState<"form" | "otp">("form");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);
  const callbackFailureMessage =
    authError === "auth_callback_failed"
      ? authErrorDescription ??
        "Email confirmation failed or expired. Sign in again or request a new confirmation email."
      : null;
  const confirmedMessage = emailConfirmed
    ? "Your email is confirmed. Sign in with your password to continue."
    : null;
  const displayError = error ?? callbackFailureMessage;
  const displayNotice = !displayError && confirmedMessage ? confirmedMessage : null;

  const emailState = emailValidationState(email, emailTouched);
  const phoneState = phoneValidationState(phone, phoneTouched);
  const guestFormValid = isValidEmail(email) && isValidPhone(phone);

  const handleAuthSuccess = () => {
    document.cookie = `${AUTH_NEXT_COOKIE}=; path=/; max-age=0`;
    window.location.assign(destination);
  };

  const handleOAuthSignIn = async (provider: OAuthProviderId) => {
    setStatus("submitting");
    setError(null);

    const result = await startOAuthSignIn(provider, destination);

    if (result.error) {
      setError(result.error);
      setStatus("idle");
    }
  };

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "login",
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const result = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Authentication failed");
      }

      handleAuthSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setStatus("idle");
    }
  };

  const handleGuestFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setPhoneTouched(true);
    if (!guestFormValid) return;
    setError(null);
    // OTP delivery is not implemented — create the guest session directly.
    void handleGuestVerificationComplete();
  };

  const handleGuestVerificationComplete = async () => {
    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "guest",
          email: email.trim().toLowerCase(),
          phone: normalizePhoneDigits(phone),
        }),
      });

      const result = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Guest initialization failed");
      }

      handleAuthSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Guest initialization failed");
      setStatus("idle");
    }
  };

  if (activeTab === "guest" && guestStep === "otp") {
    return (
      <OtpVerificationPlaceholder
        email={email.trim().toLowerCase()}
        phone={formatPhoneDisplay(phone)}
        backHref={buildAttendeeGateUrl(destination)}
        onBack={() => setGuestStep("form")}
        onVerify={() => void handleGuestVerificationComplete()}
        isSubmitting={status === "submitting"}
        error={error}
      />
    );
  }

  if (activeTab === "guest") {
    return (
      <EmailGateShell backHref={hubBackHref} backLabel="Back to entry hub">
        <form onSubmit={handleGuestFormSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            placeholder="Email"
            className={gateFieldClass(emailState === "valid", emailState === "invalid")}
          />
          <ValidationHint
            valid={emailState === "valid"}
            invalid={emailState === "invalid"}
            validMessage="Valid email"
            invalidMessage="Enter a valid email"
          />

          <input
            type="tel"
            inputMode="numeric"
            required
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(normalizePhoneDigits(e.target.value))}
            onBlur={() => setPhoneTouched(true)}
            placeholder="Phone"
            className={gateFieldClass(phoneState === "valid", phoneState === "invalid")}
          />
          <ValidationHint
            valid={phoneState === "valid"}
            invalid={phoneState === "invalid"}
            validMessage="Valid phone"
            invalidMessage="Enter a 10-digit US phone number"
          />

          <PrimaryGateButton type="submit" disabled={!guestFormValid}>
            Continue
          </PrimaryGateButton>

          <button
            type="button"
            className="mt-2 w-full min-h-11 font-ui text-xs text-brand-muted underline"
            onClick={() => {
              setActiveTab("login");
              setError(null);
            }}
          >
            Back to login
          </button>
        </form>

        {displayError ? (
          <p role="alert" className="mt-4 font-body text-sm text-brand-pink">
            {displayError}
          </p>
        ) : null}
      </EmailGateShell>
    );
  }

  return (
    <AttendeeAuthLoginPlate
      createAccountHref={buildCreateAccountUrl(destination)}
      forgotPasswordHref={buildForgotPasswordUrl(destination)}
      email={email}
      password={password}
      showPassword={showPassword}
      rememberMe={rememberMe}
      isSubmitting={status === "submitting"}
      formError={displayError}
      formNotice={displayNotice}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onEmailBlur={() => setEmailTouched(true)}
      onToggleShowPassword={() => setShowPassword((current) => !current)}
      onRememberMeChange={setRememberMe}
      onSubmit={(event) => void handleCredentialSubmit(event)}
      onGuest={() => {
        setActiveTab("guest");
        setError(null);
      }}
      onOAuthSignIn={(provider) => void handleOAuthSignIn(provider)}
    />
  );
}
