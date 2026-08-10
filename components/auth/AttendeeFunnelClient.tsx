"use client";

import { useState } from "react";
import AttendeeAuthLoginPlate from "@/components/auth/AttendeeAuthLoginPlate";
import { startOAuthSignIn, type OAuthProviderId } from "@/lib/auth/oauth-sign-in";
import {
  buildCreateAccountUrl,
  clearAuthNextCookie,
  resolveAttendeeDestination,
} from "@/lib/auth/routing";

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const handleAuthSuccess = () => {
    clearAuthNextCookie();
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

  const handleCredentialSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed");
      setStatus("idle");
    }
  };

  return (
    <AttendeeAuthLoginPlate
      createAccountHref={buildCreateAccountUrl(destination)}
      email={email}
      password={password}
      showPassword={showPassword}
      rememberMe={rememberMe}
      isSubmitting={status === "submitting"}
      formError={displayError}
      formNotice={displayNotice}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onToggleShowPassword={() => setShowPassword((current) => !current)}
      onRememberMeChange={setRememberMe}
      onSubmit={(event) => void handleCredentialSubmit(event)}
      onOAuthSignIn={(provider) => void handleOAuthSignIn(provider)}
    />
  );
}
