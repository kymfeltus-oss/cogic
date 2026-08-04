"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { CREATE_ACCOUNT_MIN_PASSWORD_LENGTH } from "@/lib/auth/create-account-validation";
import { AUTH_NEXT_COOKIE } from "@/lib/auth/routing";
import { EXPERIENCE_BRAND_ASSETS } from "@/lib/experience/brand-assets";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type ResetPasswordClientProps = {
  nextPath: string;
  loginHref: string;
};

const inputClassName =
  "w-full rounded-xl border border-brand-border bg-brand-panel/80 py-3 font-body text-sm text-white outline-none transition placeholder:text-brand-muted/45 focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/25 disabled:opacity-60";

export default function ResetPasswordClient({
  nextPath,
  loginHref,
}: ResetPasswordClientProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verifyRecoverySession() {
      const supabase = createBrowserSupabaseClient();
      const hashParams = new URLSearchParams(
        typeof window !== "undefined" ? window.location.hash.slice(1) : "",
      );
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");

      if (accessToken && refreshToken && hashType === "recovery") {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
          if (!cancelled) {
            setHasSession(true);
            setIsCheckingSession(false);
          }
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!cancelled) {
        setHasSession(Boolean(session));
        setIsCheckingSession(false);
      }
    }

    void verifyRecoverySession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < CREATE_ACCOUNT_MIN_PASSWORD_LENGTH) {
      setError(
        `Password must be at least ${CREATE_ACCOUNT_MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, confirmPassword }),
      });

      const result = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to reset password.");
      }

      setDone(true);
      document.cookie = `${AUTH_NEXT_COOKIE}=; path=/; max-age=0`;
      window.setTimeout(() => {
        window.location.assign(nextPath);
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
      setIsSubmitting(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-brand-black text-brand-muted">
        <Loader2 className="size-6 animate-spin text-brand-blue" aria-hidden="true" />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="auth-login-page flex min-h-dvh flex-col items-center justify-center px-6 text-center text-white">
        <p className="font-body text-sm text-brand-muted">
          This reset link expired or is invalid.
        </p>
        <Link
          href={loginHref}
          className="mt-6 font-ui text-xs font-bold uppercase tracking-[0.14em] text-brand-blue"
        >
          Request a new link
        </Link>
      </div>
    );
  }

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
            New Password
          </h1>
          <p className="mx-auto mt-2 max-w-[18rem] px-4 font-body text-[0.82rem] leading-snug text-brand-muted sm:px-6">
            {done
              ? "Password updated. Redirecting you now…"
              : "Choose a new password for your account."}
          </p>
        </header>

        <div className="px-4 sm:px-6">
          <div className="glass-panel rounded-[1.25rem] border border-brand-border p-5 shadow-[0_0_40px_rgba(0,168,255,0.06)] sm:p-7">
            {done ? (
              <p className="rounded-lg border border-brand-blue/30 bg-brand-blue/10 px-3 py-2 text-center font-body text-sm text-brand-blue">
                Password saved successfully.
              </p>
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    New password
                  </span>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-pink"
                      aria-hidden="true"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={CREATE_ACCOUNT_MIN_PASSWORD_LENGTH}
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      className={`${inputClassName} pl-10 pr-11`}
                    />
                    <button
                      type="button"
                      className="touch-target absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-brand-muted transition hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      disabled={isSubmitting}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Confirm password
                  </span>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-pink"
                      aria-hidden="true"
                    />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={CREATE_ACCOUNT_MIN_PASSWORD_LENGTH}
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter password"
                      className={`${inputClassName} pl-10 pr-11`}
                    />
                    <button
                      type="button"
                      className="touch-target absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-brand-muted transition hover:text-white"
                      aria-label={
                        showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                      }
                      disabled={isSubmitting}
                      onClick={() => setShowConfirmPassword((current) => !current)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
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
                      Saving…
                    </>
                  ) : (
                    <>
                      Update Password
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
