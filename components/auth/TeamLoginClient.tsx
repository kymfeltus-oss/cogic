"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import EmailGateShell, {
  gateFieldClass,
  PrimaryGateButton,
  ValidationHint,
} from "@/components/auth/EmailGateShell";
import {
  buildGateUrl,
  buildTeamPostAuthUrl,
  PERSONA_HUB_PATH,
  resolveTeamDestination,
} from "@/lib/auth/routing";
import { emailValidationState } from "@/lib/auth/validation";

type TeamLoginClientProps = {
  nextPath: string;
  authError?: string | null;
};

export default function TeamLoginClient({ nextPath, authError }: TeamLoginClientProps) {
  const resolvedNext = resolveTeamDestination(nextPath);
  const hubBackHref = buildGateUrl(PERSONA_HUB_PATH, resolvedNext);
  const postAuthHref = buildTeamPostAuthUrl(resolvedNext);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  const emailState = emailValidationState(email, emailTouched);
  const callbackFailureMessage =
    authError === "auth_callback_failed"
      ? "Email confirmation failed or expired. Sign in again or request a new confirmation email."
      : null;
  const displayError = error ?? callbackFailureMessage;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) return;

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
        throw new Error(result.error ?? "Team authentication failed");
      }

      window.location.assign(postAuthHref);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Team authentication failed");
      setStatus("idle");
    }
  };

  return (
    <EmailGateShell
      shellRef={shellRef}
      layout="fluid"
      eyebrow="Team Access"
      title="Promoter & Team Login"
      description="Secure credentials for team-only areas."
      backHref={hubBackHref}
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <div>
          <label className="mb-1.5 block font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-muted">
            Team Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setEmailTouched(true)}
            placeholder="producer@vitalorgansent.com"
            className={gateFieldClass(emailState === "valid", emailState === "invalid")}
          />
          <ValidationHint
            valid={emailState === "valid"}
            invalid={emailState === "invalid"}
            validMessage="Valid email format"
            invalidMessage="Enter a valid team email"
          />
        </div>

        <div>
          <label className="mb-1.5 block font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-muted">
            Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Team credentials"
            className={gateFieldClass(false, false)}
          />
        </div>

        <PrimaryGateButton type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </PrimaryGateButton>
      </form>

      {displayError ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-brand-pink/40 bg-brand-pink/10 px-4 py-3 text-center font-body text-sm text-white"
        >
          {displayError}
        </p>
      ) : null}
    </EmailGateShell>
  );
}
