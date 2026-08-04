"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AWAKENING_AUTH_SIGNUP_PANELS } from "@/lib/experience/awakening-auth-assets";
import { authRectStyle } from "@/lib/experience/auth-layout-slots";
import {
  applyFullNameInput,
  formatFullName,
  type CreateAccountFormValues,
} from "@/lib/auth/create-account-validation";
import { US_STATES } from "@/lib/auth/us-states";

type CreateAccountMobileFormProps = {
  loginHref: string;
  values: CreateAccountFormValues;
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

export default function CreateAccountMobileForm({
  loginHref,
  values,
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
}: CreateAccountMobileFormProps) {
  const panels = AWAKENING_AUTH_SIGNUP_PANELS;
  const fullName = formatFullName(values);

  return (
    <form
      onSubmit={onSubmit}
      className="auth-attendee-overlay-form"
      aria-label="Create account"
      autoComplete="on"
      noValidate
    >
      <button
        type="button"
        aria-label="Upload profile photo"
        disabled={isSubmitting}
        className="auth-attendee-hit auth-attendee-link-hit auth-attendee-interactive"
        style={authRectStyle(panels.avatarUpload)}
        onClick={onAvatarPick}
      />

      <input
        type="text"
        required
        autoComplete="name"
        disabled={isSubmitting}
        value={fullName}
        onChange={(event) => {
          const parsed = applyFullNameInput(event.target.value);
          onFieldChange("firstName", parsed.firstName);
          onFieldChange("lastName", parsed.lastName);
        }}
        onBlur={onBlur}
        placeholder=" "
        aria-label="Full name"
        className="auth-attendee-field auth-attendee-interactive"
        style={authRectStyle(panels.fullName)}
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
        placeholder=" "
        aria-label="Email address"
        className="auth-attendee-field auth-attendee-interactive"
        style={authRectStyle(panels.email)}
      />

      <input
        type="text"
        required
        autoComplete="address-level2"
        disabled={isSubmitting}
        value={values.city}
        onChange={(event) => onFieldChange("city", event.target.value)}
        onBlur={onBlur}
        placeholder=" "
        aria-label="City"
        className="auth-attendee-field auth-attendee-interactive"
        style={authRectStyle(panels.city)}
      />

      <select
        required
        disabled={isSubmitting}
        value={values.state}
        onChange={(event) => onFieldChange("state", event.target.value)}
        onBlur={onBlur}
        aria-label="State"
        className="auth-attendee-field auth-attendee-field--select auth-attendee-interactive"
        style={authRectStyle(panels.state)}
      >
        <option value="" disabled>
          State
        </option>
        {US_STATES.map((state) => (
          <option key={state.code} value={state.code}>
            {state.name}
          </option>
        ))}
      </select>

      <input
        type={showPassword ? "text" : "password"}
        required
        autoComplete="new-password"
        disabled={isSubmitting}
        value={values.password}
        onChange={(event) => onFieldChange("password", event.target.value)}
        onBlur={onBlur}
        placeholder=" "
        aria-label="Create password"
        className="auth-attendee-field auth-attendee-field--password auth-attendee-interactive"
        style={authRectStyle(panels.password)}
      />

      <button
        type="button"
        aria-label={showPassword ? "Hide password" : "Show password"}
        disabled={isSubmitting}
        className="auth-attendee-hit auth-attendee-password-toggle auth-attendee-interactive"
        style={authRectStyle({
          left: panels.password.left + panels.password.width - 10,
          top: panels.password.top,
          width: 9,
          height: panels.password.height,
        })}
        onClick={onToggleShowPassword}
      />

      <input
        type={showConfirmPassword ? "text" : "password"}
        required
        autoComplete="new-password"
        disabled={isSubmitting}
        value={values.confirmPassword}
        onChange={(event) => onFieldChange("confirmPassword", event.target.value)}
        onBlur={onBlur}
        placeholder=" "
        aria-label="Confirm password"
        className="auth-attendee-field auth-attendee-field--password auth-attendee-interactive"
        style={authRectStyle(panels.confirmPassword)}
      />

      <button
        type="button"
        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
        disabled={isSubmitting}
        className="auth-attendee-hit auth-attendee-password-toggle auth-attendee-interactive"
        style={authRectStyle({
          left: panels.confirmPassword.left + panels.confirmPassword.width - 10,
          top: panels.confirmPassword.top,
          width: 9,
          height: panels.confirmPassword.height,
        })}
        onClick={onToggleShowConfirmPassword}
      />

      <label
        className="auth-attendee-hit auth-attendee-remember auth-attendee-interactive"
        style={authRectStyle(panels.termsCheckbox)}
      >
        <input
          type="checkbox"
          checked={values.acceptedTerms}
          disabled={isSubmitting}
          onChange={(event) => onFieldChange("acceptedTerms", event.target.checked)}
          onBlur={onBlur}
          required
          className="auth-attendee-checkbox"
        />
        <span className="sr-only">Accept terms of service and privacy policy</span>
      </label>

      <button
        type="submit"
        disabled={isSubmitting || !canSubmit}
        aria-label="Create account"
        className="auth-attendee-hit auth-attendee-action-hit auth-attendee-interactive"
        style={authRectStyle(panels.submitButton)}
      >
        {isSubmitting ? (
          <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden="true" />
        ) : null}
      </button>

      <Link
        href={loginHref}
        aria-label="Back to login"
        className="auth-attendee-hit auth-attendee-link-hit auth-attendee-interactive"
        style={authRectStyle(panels.backToLogin)}
      />

      {formError ? (
        <p role="alert" className="auth-attendee-error font-body">
          {formError}
        </p>
      ) : null}
    </form>
  );
}
