"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { EXPERIENCE_BRAND_ASSETS } from "@/lib/experience/brand-assets";
import { isValidEmail } from "@/lib/auth/validation";

type ForgotPasswordClientProps = {
  nextPath: string;
  loginHref: string;
  initialEmail?: string;
};

const inputClassName =
  "w-full rounded-xl border border-brand-border bg-brand-panel/80 py-3 font-body text-sm text-white outline-none transition placeholder:text-brand-muted/45 focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/25 disabled:opacity-60";

export default function ForgotPasswordClient({
  nextPath,
  loginHref,
  initialEmail = "",
}: ForgotPasswordClientProps) {
  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!isValidEmail(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: trimmed, next: nextPath }),
      });

      const result = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to send reset email.");
      }

      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to send reset email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-login-page flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto py-3 pt-safe pb-safe sm:py-6">
      <div className="auth-login-page__glow pointer-events-none" aria-hidden="true" />

      <div className="relative z-[1] w-[var(--mobile-app-track-w)] max-w-[100vw]">
        <header className="mb-4 text-center">
          <div className="relative mx-auto h-[6.75rem] w-full max-w-[17rem] sm:h-[8rem]">
            <Image
              src={EXPERIENCE_BRAND_ASSETS.lockup}
              alt="300 Awakening"
              fill
              priority
              sizes="(max-width: 640px) 68vw, 272px"
              className="object-contain"
            />
          </div>
          <h1 className="mt-2 px-4 font-headline text-[clamp(1.55rem,6.2vw,2.15rem)] uppercase leading-none tracking-[0.08em] text-white sm:px-6">
            Reset Password
          </h1>
          <p className="mx-auto mt-2 max-w-[18rem] px-4 font-body text-[0.82rem] leading-snug text-brand-muted sm:px-6">
            {sent
              ? "If an account exists for that email, we sent a reset link. Check your inbox."
              : "Enter your email and we will send a secure link to choose a new password."}
          </p>
        </header>

        <div className="px-4 sm:px-6">
          <div className="glass-panel rounded-[1.25rem] border border-brand-border p-5 shadow-[0_0_40px_rgba(0,168,255,0.06)] sm:p-7">
            {sent ? (
              <div className="space-y-4 text-center">
                <p className="rounded-lg border border-brand-blue/30 bg-brand-blue/10 px-3 py-2 font-body text-sm text-brand-blue">
                  Reset link sent to <span className="font-semibold text-white">{email}</span>
                </p>
                <Link
                  href={loginHref}
                  className="touch-target inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-blue/45 bg-brand-blue/12 px-6 font-ui text-[0.68rem] font-bold uppercase tracking-[0.16em] text-brand-blue transition hover:bg-brand-blue/20"
                >
                  Back to Log In
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setError(null);
                  }}
                  className="font-ui text-xs text-brand-muted underline"
                >
                  Send to a different email
                </button>
              </div>
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Email
                  </span>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-blue"
                      aria-hidden="true"
                    />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      disabled={isSubmitting}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className={`${inputClassName} pl-10`}
                    />
                  </div>
                </label>

                {error ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-brand-pink/30 bg-brand-pink/10 px-3 py-2 font-body text-sm text-brand-pink"
                  >
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="touch-target inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-blue/45 bg-brand-blue/12 px-6 font-ui text-[0.68rem] font-bold uppercase tracking-[0.16em] text-brand-blue transition hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center">
            <Link
              href={loginHref}
              className="inline-flex min-h-11 items-center gap-2 font-ui text-xs font-semibold text-brand-muted transition hover:text-brand-blue"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
