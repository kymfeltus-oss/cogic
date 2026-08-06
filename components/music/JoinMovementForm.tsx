"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import EmailGateShell, {
  gateFieldClass,
  PrimaryGateButton,
  ValidationHint,
} from "@/components/auth/EmailGateShell";
import {
  emailValidationState,
  formatPhoneDisplay,
  isValidEmail,
  isValidPhone,
  normalizePhoneDigits,
  phoneValidationState,
} from "@/lib/auth/validation";

export default function JoinMovementForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  const emailState = emailValidationState(email, emailTouched);
  const phoneState = phoneValidationState(phone, phoneTouched);
  const formValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    isValidEmail(email) &&
    isValidPhone(phone);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailTouched(true);
    setPhoneTouched(true);

    if (!formValid) {
      setError("Please complete all fields with valid information.");
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/movement/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: normalizePhoneDigits(phone),
        }),
      });

      const result = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to save your information.");
      }

      setStatus("success");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save your information.",
      );
      setStatus("idle");
    }
  };

  if (status === "success") {
    return (
      <EmailGateShell
        eyebrow="COGIC LIVE"
        title="You're In"
        description="Thank you for joining. We'll keep you connected with updates, music, and mission moments."
        backHref="/experience/music"
        backLabel="Back to Music"
      >
        <p className="font-body text-center text-sm leading-relaxed text-brand-muted">
          Your details are saved. Stay tuned for what God is doing through this sound.
        </p>
      </EmailGateShell>
    );
  }

  return (
    <EmailGateShell
      eyebrow="COGIC LIVE"
      title="Join the Movement"
      description="Stay connected. Get updates. Be part of the mission behind COGIC LIVE worship and community."
      backHref="/experience/music"
      backLabel="Back to Music"
    >
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
              First Name
            </span>
            <input
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className={gateFieldClass(firstName.trim().length > 0, false)}
              placeholder="First name"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
              Last Name
            </span>
            <input
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className={gateFieldClass(lastName.trim().length > 0, false)}
              placeholder="Last name"
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setEmailTouched(true)}
            className={gateFieldClass(emailState === "valid", emailState === "invalid")}
            placeholder="you@example.com"
            required
          />
          <ValidationHint
            valid={emailState === "valid"}
            invalid={emailState === "invalid"}
            validMessage="Email looks good."
            invalidMessage="Enter a valid email address."
          />
        </label>

        <label className="block">
          <span className="mb-2 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
            Mobile Phone
          </span>
          <input
            type="tel"
            autoComplete="tel"
            inputMode="numeric"
            value={phone}
            onChange={(event) => setPhone(formatPhoneDisplay(event.target.value))}
            onBlur={() => setPhoneTouched(true)}
            className={gateFieldClass(phoneState === "valid", phoneState === "invalid")}
            placeholder="(555) 555-5555"
            required
          />
          <ValidationHint
            valid={phoneState === "valid"}
            invalid={phoneState === "invalid"}
            validMessage="Phone number looks good."
            invalidMessage="Enter a 10-digit US phone number."
          />
        </label>

        {error ? (
          <p className="font-ui text-sm text-brand-pink" role="alert">
            {error}
          </p>
        ) : null}

        <PrimaryGateButton type="submit" disabled={status === "submitting" || !formValid}>
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving
            </>
          ) : (
            "Join the Movement"
          )}
        </PrimaryGateButton>
      </form>
    </EmailGateShell>
  );
}
