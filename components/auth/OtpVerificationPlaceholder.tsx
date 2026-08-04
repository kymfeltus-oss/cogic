"use client";

import EmailGateShell, { SecondaryGateButton } from "@/components/auth/EmailGateShell";

type OtpVerificationPlaceholderProps = {
  email: string;
  phone: string;
  backHref: string;
  onBack: () => void;
  onVerify: () => void;
  isSubmitting: boolean;
  error: string | null;
};

/**
 * OTP verification is not implemented. This surface must never present a
 * completed/verified flow. Production guest sign-in should skip this step.
 */
export default function OtpVerificationPlaceholder({
  email,
  phone,
  backHref,
  onBack,
  error,
}: OtpVerificationPlaceholderProps) {
  return (
    <EmailGateShell
      eyebrow="Guest Verification"
      title="Verification unavailable"
      description="SMS and email verification codes are not available yet. Continue as a guest from the previous step, or sign in with your account."
      backHref={backHref}
      backLabel="Back to guest form"
    >
      <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-4">
        <p className="font-body text-sm text-white/80">
          Verification for{" "}
          <span className="text-white">{email || "your email"}</span>
          {phone ? (
            <>
              {" "}
              / <span className="text-white">{phone}</span>
            </>
          ) : null}{" "}
          cannot be completed here.
        </p>
        <p className="mt-3 font-body text-xs text-white/55">
          No code was sent. This is not a completed verification step.
        </p>
      </div>

      <div className="mt-6">
        <SecondaryGateButton onClick={onBack}>Back to guest form</SecondaryGateButton>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-brand-pink/40 bg-brand-pink/10 px-4 py-3 text-center font-body text-sm text-white"
        >
          {error}
        </p>
      ) : null}
    </EmailGateShell>
  );
}
