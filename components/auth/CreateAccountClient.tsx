"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import AttendeeAuthCreateAccountPlate from "@/components/auth/AttendeeAuthCreateAccountPlate";
import {
  formatCreateAccountPhoneInput,
  isCreateAccountFormValid,
  serializeCreateAccountPayload,
  validateCreateAccountForm,
  type CreateAccountFormValues,
} from "@/lib/auth/create-account-validation";
import { buildAttendeeGateUrl, buildVerifyAccountUrl } from "@/lib/auth/routing";
import { buildClientAuthCallbackUrl } from "@/lib/auth/oauth-sign-in";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type CreateAccountClientProps = {
  nextPath: string;
};

const INITIAL_VALUES: CreateAccountFormValues = {
  title: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
  avatarFile: null,
};

export default function CreateAccountClient({ nextPath }: CreateAccountClientProps) {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<CreateAccountFormValues>(INITIAL_VALUES);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const avatarPreviewUrl = useMemo(() => {
    if (!values.avatarFile) return null;
    return URL.createObjectURL(values.avatarFile);
  }, [values.avatarFile]);

  useEffect(() => {
    if (!avatarPreviewUrl) return;
    return () => URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl]);

  const fieldErrors = useMemo(
    () => (touched ? validateCreateAccountForm(values) : {}),
    [touched, values],
  );

  const canSubmit = isCreateAccountFormValid(values) && !isSubmitting;
  const loginHref = buildAttendeeGateUrl(nextPath);

  const setField = <K extends keyof CreateAccountFormValues>(
    key: K,
    value: CreateAccountFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const uploadAvatar = async () => {
    if (!values.avatarFile) return;

    const formData = new FormData();
    formData.append("avatar", values.avatarFile);

    const response = await fetch("/api/profile/avatar", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const result = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || !result.success) {
      throw new Error(result.error ?? "Unable to upload profile photo.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);

    const errors = validateCreateAccountForm(values);
    if (Object.keys(errors).length > 0) {
      const firstError =
        errors.form ??
        errors.title ??
        errors.firstName ??
        errors.lastName ??
        errors.email ??
        errors.phone ??
        errors.city ??
        errors.state ??
        errors.password ??
        errors.confirmPassword ??
        errors.acceptedTerms ??
        errors.avatarFile ??
        "Fix the highlighted fields to continue.";
      setFormError(firstError);
      return;
    }

    if (!canSubmit) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = serializeCreateAccountPayload(values);
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            is_guest: false,
            title: payload.title,
            first_name: payload.firstName,
            last_name: payload.lastName,
            phone: payload.phone,
            city: payload.city,
            state: payload.state,
          },
          emailRedirectTo: buildClientAuthCallbackUrl(nextPath),
        },
      });

      if (error || !data.user) {
        throw new Error(error?.message ?? "Unable to create account.");
      }

      if (!data.session) {
        window.location.assign(buildVerifyAccountUrl(payload.email, nextPath));
        return;
      }

      await fetch("/api/auth/sync-identity", {
        method: "POST",
        credentials: "include",
      });

      if (values.avatarFile) {
        await uploadAvatar();
      }

      window.location.assign(nextPath);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to create account.");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AttendeeAuthCreateAccountPlate
        loginHref={loginHref}
        values={values}
        avatarPreviewUrl={avatarPreviewUrl}
        showPassword={showPassword}
        showConfirmPassword={showConfirmPassword}
        isSubmitting={isSubmitting}
        canSubmit={canSubmit}
        formError={
          formError ??
          (touched && Object.keys(fieldErrors).length > 0
            ? fieldErrors.title ??
              fieldErrors.firstName ??
              fieldErrors.lastName ??
              fieldErrors.email ??
              fieldErrors.phone ??
              fieldErrors.city ??
              fieldErrors.state ??
              fieldErrors.password ??
              fieldErrors.confirmPassword ??
              fieldErrors.acceptedTerms ??
              fieldErrors.avatarFile ??
              "Fix the highlighted fields to continue."
            : null)
        }
        onFieldChange={(key, value) => {
          if (key === "phone") {
            setField("phone", formatCreateAccountPhoneInput(String(value)));
            return;
          }
          setField(key, value);
        }}
        onBlur={() => setTouched(true)}
        onToggleShowPassword={() => setShowPassword((current) => !current)}
        onToggleShowConfirmPassword={() => setShowConfirmPassword((current) => !current)}
        onAvatarPick={() => fileInputRef.current?.click()}
        onSubmit={(event) => void handleSubmit(event)}
      />

      <input
        ref={fileInputRef}
        id={`${formId}-avatar`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setField("avatarFile", file);
        }}
        aria-label="Upload profile photo"
      />
    </>
  );
}
