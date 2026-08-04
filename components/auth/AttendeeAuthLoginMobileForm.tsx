"use client";

import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { OAuthProviderId } from "@/lib/auth/oauth-sign-in";
import {
  AWAKENING_AUTH_LOGIN_COMPONENTS,
  AWAKENING_AUTH_LOGIN_FORM,
  awakeningAuthAssetUrl,
} from "@/lib/experience/awakening-auth-assets";

type AttendeeAuthLoginMobileFormProps = {
  createAccountHref: string;
  forgotPasswordHref: string;
  email: string;
  password: string;
  showPassword: boolean;
  rememberMe: boolean;
  isSubmitting: boolean;
  formError?: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onEmailBlur: () => void;
  onToggleShowPassword: () => void;
  onRememberMeChange: (checked: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onOAuthSignIn: (provider: OAuthProviderId) => void;
};

type LoginPlateProps = {
  component: (typeof AWAKENING_AUTH_LOGIN_COMPONENTS)[keyof typeof AWAKENING_AUTH_LOGIN_COMPONENTS];
  className?: string;
  children: ReactNode;
};

function LoginPlate({ component, className = "", children }: LoginPlateProps) {
  return (
    <div className={`auth-attendee-login-form__plate ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={awakeningAuthAssetUrl(component.src)}
        alt=""
        width={component.width}
        height={component.height}
        className="auth-attendee-login-form__plate-art"
        loading="eager"
        decoding="async"
        draggable={false}
      />
      <div className="auth-attendee-login-form__plate-controls">{children}</div>
    </div>
  );
}

export default function AttendeeAuthLoginMobileForm({
  createAccountHref,
  forgotPasswordHref,
  email,
  password,
  showPassword,
  rememberMe,
  isSubmitting,
  formError,
  onEmailChange,
  onPasswordChange,
  onEmailBlur,
  onToggleShowPassword,
  onRememberMeChange,
  onSubmit,
  onOAuthSignIn,
}: AttendeeAuthLoginMobileFormProps) {
  const formAnchor = AWAKENING_AUTH_LOGIN_FORM;
  const components = AWAKENING_AUTH_LOGIN_COMPONENTS;
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncAutofill = () => {
      const emailInput = emailRef.current;
      const passwordInput = passwordRef.current;

      if (emailInput?.value.includes("@") && emailInput.value !== email) {
        onEmailChange(emailInput.value);
      }

      if (
        passwordInput?.value &&
        !passwordInput.value.includes("@") &&
        passwordInput.value !== password
      ) {
        onPasswordChange(passwordInput.value);
      }

      if (passwordInput?.value.includes("@")) {
        passwordInput.value = "";
        onPasswordChange("");
      }
    };

    syncAutofill();
    const shortTimer = window.setTimeout(syncAutofill, 350);
    const longTimer = window.setTimeout(syncAutofill, 1200);

    return () => {
      window.clearTimeout(shortTimer);
      window.clearTimeout(longTimer);
    };
  }, [email, onEmailChange, onPasswordChange, password]);

  return (
    <form
      onSubmit={onSubmit}
      className="auth-attendee-overlay-form auth-attendee-login-form"
      aria-label="Sign in form"
      autoComplete="on"
      noValidate
      style={{
        left: `${formAnchor.left}%`,
        top: `${formAnchor.top}%`,
        width: `${formAnchor.width}%`,
      }}
    >
      <LoginPlate component={components.emailField}>
        <input
          ref={emailRef}
          id="auth-login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          enterKeyHint="next"
          disabled={isSubmitting}
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          onInput={(event) => onEmailChange(event.currentTarget.value)}
          onBlur={onEmailBlur}
          placeholder="Email Address"
          aria-label="Email address"
          className="auth-attendee-login-form__field auth-attendee-interactive font-body"
        />
      </LoginPlate>

      <LoginPlate component={components.passwordField}>
        <input
          ref={passwordRef}
          id="auth-login-password"
          name="password"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          autoComplete="current-password"
          enterKeyHint="done"
          disabled={isSubmitting}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          onInput={(event) => onPasswordChange(event.currentTarget.value)}
          placeholder="Password"
          aria-label="Password"
          className="auth-attendee-login-form__field auth-attendee-login-form__field--password auth-attendee-interactive font-body"
        />
        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          disabled={isSubmitting}
          className="auth-attendee-login-form__password-toggle auth-attendee-interactive touch-target"
          onClick={onToggleShowPassword}
        />
      </LoginPlate>

      <LoginPlate component={components.rememberRow}>
        <label className="auth-attendee-login-form__remember-hit auth-attendee-interactive">
          <span
            className="auth-attendee-login-form__remember-indicator"
            aria-hidden="true"
          >
            {rememberMe ? (
              <Check
                className="auth-attendee-login-form__remember-mark auth-attendee-login-form__remember-mark--checked"
                strokeWidth={2.5}
              />
            ) : (
              <X
                className="auth-attendee-login-form__remember-mark auth-attendee-login-form__remember-mark--unchecked"
                strokeWidth={2.5}
              />
            )}
          </span>
          <input
            type="checkbox"
            checked={rememberMe}
            disabled={isSubmitting}
            onChange={(event) => onRememberMeChange(event.target.checked)}
            className="auth-attendee-login-form__checkbox"
          />
          <span className="sr-only">Remember me</span>
        </label>
        <Link
          href={forgotPasswordHref}
          aria-label="Forgot password"
          className="auth-attendee-login-form__forgot-hit auth-attendee-interactive touch-target"
        />
      </LoginPlate>

      <LoginPlate component={components.loginButton}>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-label="Log in"
          className="auth-attendee-login-form__asset-btn auth-attendee-interactive touch-target"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden="true" />
          ) : null}
        </button>
      </LoginPlate>

      <LoginPlate component={components.createAccountButton}>
        <Link
          href={createAccountHref}
          aria-label="Create account"
          className="auth-attendee-login-form__asset-link auth-attendee-interactive touch-target"
        />
      </LoginPlate>

      <div className="auth-attendee-login-form__social" aria-label="Social sign-in">
        <LoginPlate component={components.appleButton} className="auth-attendee-login-form__plate--social">
          <button
            type="button"
            disabled={isSubmitting}
            aria-label="Continue with Apple"
            className="auth-attendee-login-form__asset-btn auth-attendee-interactive touch-target"
            onClick={() => onOAuthSignIn("apple")}
          />
        </LoginPlate>
        <LoginPlate component={components.googleButton} className="auth-attendee-login-form__plate--social">
          <button
            type="button"
            disabled={isSubmitting}
            aria-label="Continue with Google"
            className="auth-attendee-login-form__asset-btn auth-attendee-interactive touch-target"
            onClick={() => onOAuthSignIn("google")}
          />
        </LoginPlate>
        <LoginPlate component={components.facebookButton} className="auth-attendee-login-form__plate--social">
          <button
            type="button"
            disabled={isSubmitting}
            aria-label="Continue with Facebook"
            className="auth-attendee-login-form__asset-btn auth-attendee-interactive touch-target"
            onClick={() => onOAuthSignIn("facebook")}
          />
        </LoginPlate>
      </div>

      <LoginPlate component={components.signUpFooter}>
        <Link
          href={createAccountHref}
          aria-label="Don't have an account? Create account"
          className="auth-attendee-login-form__asset-link auth-attendee-interactive touch-target"
        />
      </LoginPlate>

      {formError ? (
        <p
          role="alert"
          className="auth-attendee-login-form__message auth-attendee-interactive font-body"
        >
          {formError}
        </p>
      ) : null}
    </form>
  );
}
