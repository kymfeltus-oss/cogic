"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { EXPERIENCE_BRAND_ASSETS } from "@/lib/experience/brand-assets";
import type { OAuthProviderId } from "@/lib/auth/oauth-sign-in";
import {
  AWAKENING_AUTH_LOGIN_COMPONENTS,
  awakeningAuthAssetUrl,
} from "@/lib/experience/awakening-auth-assets";

type AttendeeAuthLoginPlateProps = {
  createAccountHref: string;
  forgotPasswordHref: string;
  email: string;
  password: string;
  showPassword: boolean;
  isSubmitting: boolean;
  formError?: string | null;
  formNotice?: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onEmailBlur: () => void;
  onToggleShowPassword: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onGuest: () => void;
  onOAuthSignIn: (provider: OAuthProviderId) => void;
};

const SOCIAL_BUTTONS: ReadonlyArray<{
  provider: OAuthProviderId;
  label: string;
  asset: (typeof AWAKENING_AUTH_LOGIN_COMPONENTS)[keyof typeof AWAKENING_AUTH_LOGIN_COMPONENTS];
}> = [
  {
    provider: "apple",
    label: "Apple",
    asset: AWAKENING_AUTH_LOGIN_COMPONENTS.appleButton,
  },
  {
    provider: "google",
    label: "Google",
    asset: AWAKENING_AUTH_LOGIN_COMPONENTS.googleButton,
  },
  {
    provider: "facebook",
    label: "Facebook",
    asset: AWAKENING_AUTH_LOGIN_COMPONENTS.facebookButton,
  },
];

const inputClassName =
  "w-full rounded-xl border border-brand-border bg-brand-panel/80 py-3 font-body text-sm text-white outline-none transition placeholder:text-brand-muted/45 focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/25 disabled:opacity-60";

export default function AttendeeAuthLoginPlate({
  createAccountHref,
  forgotPasswordHref,
  email,
  password,
  showPassword,
  isSubmitting,
  formError,
  formNotice,
  onEmailChange,
  onPasswordChange,
  onEmailBlur,
  onToggleShowPassword,
  onSubmit,
  onGuest,
  onOAuthSignIn,
}: AttendeeAuthLoginPlateProps) {
  const displayMessage = formError ?? formNotice;
  const messageIsError = Boolean(formError);

  return (
    <div className="auth-login-page flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto py-3 pt-safe pb-safe sm:py-6">
      <div className="auth-login-page__glow pointer-events-none" aria-hidden="true" />

      <div className="relative z-[1] w-[var(--mobile-app-track-w)] max-w-[100vw]">
        <header className="mb-4 text-center">
          <div className="relative mx-auto h-[6.75rem] w-full max-w-[17rem] sm:h-[8rem]">
            <Image
              src={EXPERIENCE_BRAND_ASSETS.lockup}
              alt="COGIC LIVE"
              fill
              priority
              sizes="(max-width: 640px) 68vw, 272px"
              className="object-contain"
            />
          </div>
          <h1 className="mt-2 px-4 font-headline text-[clamp(1.55rem,6.2vw,2.15rem)] uppercase leading-none tracking-[0.08em] text-white sm:px-6">
            Welcome Back
          </h1>
          <p className="mx-auto mt-2 max-w-[17rem] px-4 font-body text-[0.82rem] leading-snug text-brand-muted sm:px-6">
            Sign in to pick up your journey where you left off.
          </p>
        </header>

        <div className="px-4 sm:px-6">
        <div className="glass-panel rounded-[1.25rem] border border-brand-border p-5 shadow-[0_0_40px_rgba(0,168,255,0.06)] sm:p-7">
          <form onSubmit={onSubmit} aria-label="Log in" autoComplete="on" noValidate className="space-y-4">
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
                  id="auth-login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  disabled={isSubmitting}
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  onBlur={onEmailBlur}
                  placeholder="you@example.com"
                  className={`${inputClassName} pl-10`}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
                Password
              </span>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-pink"
                  aria-hidden="true"
                />
                <input
                  id="auth-login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  placeholder="Enter your password"
                  className={`${inputClassName} pl-10 pr-11`}
                />
                <button
                  type="button"
                  className="touch-target absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-brand-muted transition hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isSubmitting}
                  onClick={onToggleShowPassword}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Link
                href={forgotPasswordHref}
                className="touch-target inline-flex items-center px-2 font-ui text-xs font-semibold text-brand-pink transition hover:opacity-80"
              >
                Forgot password?
              </Link>
            </div>

            {displayMessage ? (
              <p
                role={messageIsError ? "alert" : "status"}
                className={
                  messageIsError
                    ? "rounded-lg border border-brand-pink/30 bg-brand-pink/10 px-3 py-2 font-body text-sm text-brand-pink"
                    : "rounded-lg border border-brand-blue/30 bg-brand-blue/10 px-3 py-2 font-body text-sm text-brand-blue"
                }
              >
                {displayMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="touch-target mt-1 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-blue/45 bg-brand-blue/12 px-6 font-ui text-[0.68rem] font-bold uppercase tracking-[0.16em] text-brand-blue transition hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  Log In
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <div className="auth-login-page__divider my-6">
            <span>Or continue with</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {SOCIAL_BUTTONS.map(({ provider, label, asset }) => (
              <button
                key={provider}
                type="button"
                disabled={isSubmitting}
                aria-label={`Continue with ${label}`}
                onClick={() => onOAuthSignIn(provider)}
                className="touch-target overflow-hidden rounded-xl transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Image
                  src={awakeningAuthAssetUrl(asset.src)}
                  alt=""
                  width={asset.width}
                  height={asset.height}
                  sizes="(max-width: 640px) 28vw, 120px"
                  className="h-auto w-full object-contain"
                />
                <span className="sr-only">Continue with {label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-3 text-center">
          <p className="font-body text-sm text-brand-muted">
            Don&apos;t have an account?{" "}
            <Link
              href={createAccountHref}
              className="touch-target inline-flex items-center px-2 font-semibold text-brand-pink transition hover:opacity-80"
            >
              Create account
            </Link>
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link
              href="/experience/join-movement"
              className="touch-target inline-flex items-center px-2 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-brand-muted transition hover:text-brand-blue"
            >
              Join the movement
            </Link>
            <span className="text-brand-border" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              onClick={onGuest}
              disabled={isSubmitting}
              className="touch-target inline-flex items-center px-2 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-brand-muted transition hover:text-brand-blue"
            >
              Continue as guest
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
