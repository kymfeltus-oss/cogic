"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Camera,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
  X,
} from "lucide-react";
import {
  type CreateAccountFormValues,
} from "@/lib/auth/create-account-validation";
import { US_STATES } from "@/lib/auth/us-states";

type AttendeeAuthCreateAccountPlateProps = {
  loginHref: string;
  values: CreateAccountFormValues;
  avatarPreviewUrl?: string | null;
  showPassword: boolean;
  showConfirmPassword: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  formError?: string | null;
  onFieldChange: <K extends keyof CreateAccountFormValues>(
    key: K,
    value: CreateAccountFormValues[K],
  ) => void;
  onBlur: () => void;
  onToggleShowPassword: () => void;
  onToggleShowConfirmPassword: () => void;
  onAvatarPick: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

const inputClassName =
  "cogic-auth-input w-full py-3 text-sm outline-none transition disabled:opacity-60";

const labelClassName =
  "cogic-auth-label mb-1.5 block text-[0.62rem] font-bold uppercase tracking-[0.18em]";

export default function AttendeeAuthCreateAccountPlate({
  loginHref,
  values,
  avatarPreviewUrl,
  showPassword,
  showConfirmPassword,
  isSubmitting,
  canSubmit,
  formError,
  onFieldChange,
  onBlur,
  onToggleShowPassword,
  onToggleShowConfirmPassword,
  onAvatarPick,
  onSubmit,
}: AttendeeAuthCreateAccountPlateProps) {
  return (
    <div className="cogic-auth-page flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto py-5 pt-safe pb-safe sm:py-10">
      <div className="cogic-auth-page__glow pointer-events-none" aria-hidden="true" />

      <div className="relative z-[1] w-[var(--mobile-app-track-w)] max-w-[100vw] px-4">
        <header className="mb-4 text-center">
          <div className="mx-auto flex h-[4.75rem] items-center justify-center gap-3 sm:h-[5.5rem] sm:gap-4">
            <div className="relative size-[4.6rem] shrink-0 sm:size-[5.25rem]">
              <Image
                src="/branding/cogic-seal.png"
                alt="Church of God in Christ seal"
                fill
                priority
                sizes="84px"
                className="object-contain"
              />
            </div>
            <div className="relative h-[3.25rem] w-[13rem] sm:h-[3.75rem] sm:w-[15rem]">
              <Image
                src="/my-sanctuary/cogic-live-logo.png"
                alt="COGIC LIVE"
                fill
                priority
                sizes="(max-width: 640px) 208px, 240px"
                className="object-contain"
              />
            </div>
          </div>
          <h1 className="cogic-auth-title mt-5 text-[clamp(1.65rem,6.2vw,2.3rem)] leading-none">
            Create Account
          </h1>
          <p className="cogic-auth-copy mx-auto mt-3 max-w-[20rem] text-[0.86rem] leading-relaxed">
            Create your account for the complete COGIC LIVE experience.
          </p>
        </header>

        <div className="cogic-auth-card p-5 sm:p-7">
          <form
            onSubmit={onSubmit}
            aria-label="Create account"
            autoComplete="on"
            noValidate
            className="space-y-4"
          >
            <div className="flex items-center gap-4 rounded-xl border border-brand-border/80 bg-brand-black/30 p-3">
              <button
                type="button"
                aria-label="Upload profile photo"
                disabled={isSubmitting}
                onClick={onAvatarPick}
                className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-blue/35 bg-brand-panel/80 transition hover:border-brand-blue/60"
              >
                {avatarPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreviewUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <Camera className="size-6 text-brand-blue" aria-hidden="true" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white">
                  Profile photo
                </p>
                <p className="mt-0.5 font-body text-xs text-brand-muted">
                  Optional · JPG, PNG, or WebP up to 5 MB
                </p>
                {values.avatarFile ? (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => onFieldChange("avatarFile", null)}
                    className="mt-1.5 inline-flex items-center gap-1 font-ui text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-brand-pink transition hover:opacity-80"
                  >
                    <X className="size-3" aria-hidden="true" />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            <label className="block">
              <span className={labelClassName}>Title (optional)</span>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-pink"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  autoComplete="honorific-prefix"
                  maxLength={40}
                  disabled={isSubmitting}
                  value={values.title}
                  onChange={(event) => onFieldChange("title", event.target.value)}
                  onBlur={onBlur}
                  placeholder="Bishop, Pastor, Elder..."
                  className={`${inputClassName} pl-10`}
                />
              </div>
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClassName}>First name</span>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-blue"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    required
                    autoComplete="given-name"
                    disabled={isSubmitting}
                    value={values.firstName}
                    onChange={(event) => onFieldChange("firstName", event.target.value)}
                    onBlur={onBlur}
                    placeholder="First name"
                    className={`${inputClassName} pl-10`}
                  />
                </div>
              </label>

              <label className="block">
                <span className={labelClassName}>Last name</span>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-purple"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    required
                    autoComplete="family-name"
                    disabled={isSubmitting}
                    value={values.lastName}
                    onChange={(event) => onFieldChange("lastName", event.target.value)}
                    onBlur={onBlur}
                    placeholder="Last name"
                    className={`${inputClassName} pl-10`}
                  />
                </div>
              </label>
            </div>

            <label className="block">
              <span className={labelClassName}>Email</span>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-purple"
                  aria-hidden="true"
                />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  disabled={isSubmitting}
                  value={values.email}
                  onChange={(event) => onFieldChange("email", event.target.value)}
                  onBlur={onBlur}
                  placeholder="you@example.com"
                  className={`${inputClassName} pl-10`}
                />
              </div>
            </label>

            <label className="block">
              <span className={labelClassName}>Phone</span>
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-pink"
                  aria-hidden="true"
                />
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  disabled={isSubmitting}
                  value={values.phone}
                  onChange={(event) => onFieldChange("phone", event.target.value)}
                  onBlur={onBlur}
                  placeholder="(555) 555-5555"
                  className={`${inputClassName} pl-10`}
                />
              </div>
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_0.8fr]">
              <label className="block">
                <span className={labelClassName}>City</span>
                <div className="relative">
                  <MapPin
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-blue"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    required
                    autoComplete="address-level2"
                    disabled={isSubmitting}
                    value={values.city}
                    onChange={(event) => onFieldChange("city", event.target.value)}
                    onBlur={onBlur}
                    placeholder="Your city"
                    className={`${inputClassName} pl-10`}
                  />
                </div>
              </label>

              <label className="block">
                <span className={labelClassName}>State</span>
                <div className="relative">
                  <select
                    required
                    disabled={isSubmitting}
                    value={values.state}
                    onChange={(event) => onFieldChange("state", event.target.value)}
                    onBlur={onBlur}
                    aria-label="State"
                    className={`${inputClassName} appearance-none px-4 pr-10 ${!values.state ? "text-brand-muted/45" : ""}`}
                  >
                    <option value="" disabled>
                      State
                    </option>
                    {US_STATES.map((state) => (
                      <option key={state.code} value={state.code} className="text-white">
                        {state.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-muted"
                    aria-hidden="true"
                  />
                </div>
              </label>
            </div>

            <label className="block">
              <span className={labelClassName}>Password</span>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-pink"
                  aria-hidden="true"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  disabled={isSubmitting}
                  value={values.password}
                  onChange={(event) => onFieldChange("password", event.target.value)}
                  onBlur={onBlur}
                  placeholder="At least 8 characters"
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

            <label className="block">
              <span className={labelClassName}>Confirm password</span>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-purple"
                  aria-hidden="true"
                />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  value={values.confirmPassword}
                  onChange={(event) => onFieldChange("confirmPassword", event.target.value)}
                  onBlur={onBlur}
                  placeholder="Re-enter your password"
                  className={`${inputClassName} pl-10 pr-11`}
                />
                <button
                  type="button"
                  className="touch-target absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-brand-muted transition hover:text-white"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  disabled={isSubmitting}
                  onClick={onToggleShowConfirmPassword}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </label>

            <label className="touch-target flex cursor-pointer items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={values.acceptedTerms}
                disabled={isSubmitting}
                onChange={(event) => onFieldChange("acceptedTerms", event.target.checked)}
                onBlur={onBlur}
                required
                className="auth-login-page__checkbox mt-0.5 size-4 shrink-0 rounded border-brand-border bg-brand-panel accent-brand-blue"
              />
              <span className="font-body text-base leading-relaxed text-brand-muted">
                I agree to the Terms of Service and Privacy Policy.
              </span>
            </label>

            {formError ? (
              <p
                role="alert"
                className="rounded-lg border border-brand-pink/30 bg-brand-pink/10 px-3 py-2 font-body text-sm text-brand-pink"
              >
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="touch-target mt-1 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-blue/45 bg-brand-blue/12 px-6 font-ui text-[0.68rem] font-bold uppercase tracking-[0.16em] text-brand-blue transition hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Creating account…
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center font-body text-sm text-brand-muted">
          Already have an account?{" "}
          <Link
            href={loginHref}
            className="font-semibold text-brand-pink transition hover:opacity-80"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
