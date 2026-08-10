"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { OAuthProviderId } from "@/lib/auth/oauth-sign-in";

type AttendeeAuthLoginPlateProps = {
  createAccountHref: string;
  email: string;
  password: string;
  showPassword: boolean;
  rememberMe: boolean;
  isSubmitting: boolean;
  formError?: string | null;
  formNotice?: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onRememberMeChange: (checked: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
  onOAuthSignIn: (provider: OAuthProviderId) => void;
};

export default function AttendeeAuthLoginPlate({
  createAccountHref,
  email,
  password,
  showPassword,
  rememberMe,
  isSubmitting,
  formError,
  formNotice,
  onEmailChange,
  onPasswordChange,
  onToggleShowPassword,
  onRememberMeChange,
  onSubmit,
  onOAuthSignIn,
}: AttendeeAuthLoginPlateProps) {
  const displayMessage = formError ?? formNotice;
  const messageIsError = Boolean(formError);

  return (
    <div className="cogic-login-artboard">
      <div className="cogic-login-artboard__frame">
        <Image
          src="/login/login-background-with-fields-clean.png"
          alt=""
          fill
          priority
          sizes="(max-width: 512px) 100vw, 32rem"
          className="object-contain"
        />

        <form
          onSubmit={onSubmit}
          aria-label="Log in"
          autoComplete="on"
          noValidate
          className="cogic-login-artboard__form"
        >
          <h1 className="sr-only">COGIC LIVE login</h1>

          <label className="cogic-login-artboard__field cogic-login-artboard__field--email">
            <span className="sr-only">Email address</span>
            <input
              id="auth-login-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              disabled={isSubmitting}
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder=" "
            />
          </label>

          <label className="cogic-login-artboard__field cogic-login-artboard__field--password">
            <span className="sr-only">Password</span>
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
              placeholder=" "
            />
          </label>

          <button
            type="button"
            className="cogic-login-artboard__password-toggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            disabled={isSubmitting}
            onClick={onToggleShowPassword}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>

          <label className="cogic-login-artboard__remember">
            <span className="sr-only">Remember me</span>
            <input
              type="checkbox"
              checked={rememberMe}
              disabled={isSubmitting}
              onChange={(event) => onRememberMeChange(event.target.checked)}
            />
            <span className="cogic-login-artboard__remember-indicator" aria-hidden="true" />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            aria-label="Log in"
            className="cogic-login-artboard__action cogic-login-artboard__action--login"
          >
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            aria-label="Continue with Apple"
            onClick={() => onOAuthSignIn("apple")}
            className="cogic-login-artboard__action cogic-login-artboard__action--apple"
          />

          <button
            type="button"
            disabled={isSubmitting}
            aria-label="Continue with Google"
            onClick={() => onOAuthSignIn("google")}
            className="cogic-login-artboard__action cogic-login-artboard__action--google"
          />

          <Link
            href={createAccountHref}
            aria-label="Create account"
            className="cogic-login-artboard__create-account"
          />

          {displayMessage ? (
            <p
              role={messageIsError ? "alert" : "status"}
              className={`cogic-login-artboard__message${messageIsError ? " cogic-login-artboard__message--error" : ""}`}
            >
              {displayMessage}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
