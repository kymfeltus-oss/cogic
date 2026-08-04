"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { formatPhoneDisplay } from "@/lib/auth/validation";
import { US_STATES } from "@/lib/auth/us-states";
import {
  submitRegistration,
  updateRegistrationDraft,
} from "@/lib/registration/actions";
import {
  REGISTRATION_FIELD_LABELS,
  STEP_TITLES,
  stepFields,
  validateStep,
  type RegistrationFormValues,
} from "@/lib/registration/form-model";
import type { Registration } from "@/lib/registration/types";
import RegistrationStatusPanel from "@/components/registration/RegistrationStatusPanel";

type RegistrationWizardProps = {
  initialRegistration: Registration;
  initialStep: 1 | 2 | 3 | 4;
  mode: "wizard" | "review" | "submitted" | "payment_pending" | "confirmed";
};

function fieldId(prefix: string, field: string): string {
  return `${prefix}-${field}`;
}

export default function RegistrationWizard({
  initialRegistration,
  initialStep,
  mode,
}: RegistrationWizardProps) {
  const router = useRouter();
  const formId = useId();
  const [registration, setRegistration] = useState(initialRegistration);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep);
  const [values, setValues] = useState<RegistrationFormValues>(() => ({
    firstName: initialRegistration.firstName ?? "",
    lastName: initialRegistration.lastName ?? "",
    email: initialRegistration.email ?? "",
    mobilePhone: initialRegistration.mobilePhone ?? "",
    churchName: initialRegistration.churchName ?? "",
    pastorName: initialRegistration.pastorName ?? "",
    jurisdiction: initialRegistration.jurisdiction ?? "",
    streetAddress: initialRegistration.streetAddress ?? "",
    city: initialRegistration.city ?? "",
    state: initialRegistration.state ?? "",
    postalCode: initialRegistration.postalCode ?? "",
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState(mode);

  function syncFromServer(next: Registration) {
    setRegistration(next);
    setValues({
      firstName: next.firstName ?? "",
      lastName: next.lastName ?? "",
      email: next.email ?? "",
      mobilePhone: next.mobilePhone ?? "",
      churchName: next.churchName ?? "",
      pastorName: next.pastorName ?? "",
      jurisdiction: next.jurisdiction ?? "",
      streetAddress: next.streetAddress ?? "",
      city: next.city ?? "",
      state: next.state ?? "",
      postalCode: next.postalCode ?? "",
    });
  }

  if (
    viewMode === "submitted" ||
    viewMode === "payment_pending" ||
    viewMode === "confirmed"
  ) {
    return (
      <RegistrationStatusPanel
        registration={registration}
        viewMode={viewMode}
      />
    );
  }

  const currentStep = mode === "review" ? 4 : step;
  const errorSummaryId = `${formId}-error-summary`;

  function updateField<K extends keyof RegistrationFormValues>(
    key: K,
    value: RegistrationFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function draftPayloadForStep(targetStep: 1 | 2 | 3): Record<string, string> {
    const payload: Record<string, string> = {};
    for (const key of stepFields(targetStep)) {
      payload[key] = values[key];
    }
    return payload;
  }

  function continueFromStep(targetStep: 1 | 2 | 3) {
    const issues = validateStep(targetStep, values);
    if (issues.length > 0) {
      const nextErrors: Record<string, string> = {};
      for (const issue of issues) nextErrors[issue.field] = issue.message;
      setFieldErrors(nextErrors);
      setFormError("Please fix the highlighted fields before continuing.");
      return;
    }

    setFormError(null);
    startTransition(async () => {
      const result = await updateRegistrationDraft(draftPayloadForStep(targetStep));
      if (result.ok === false) {
        setFormError(result.message);
        return;
      }

      syncFromServer(result.registration);

      if (targetStep === 3) {
        router.push("/register/review");
        return;
      }

      const nextStep = (targetStep + 1) as 1 | 2 | 3;
      setStep(nextStep);
      router.replace(`/register?step=${nextStep}`);
    });
  }

  function goBack() {
    if (mode === "review") {
      router.push("/register?step=3");
      return;
    }
    if (step <= 1) return;
    const prev = (step - 1) as 1 | 2 | 3;
    setStep(prev);
    router.replace(`/register?step=${prev}`);
  }

  function handleSubmit() {
    setFormError(null);
    startTransition(async () => {
      const result = await submitRegistration(values);
      if (result.ok === false) {
        setFormError(result.message);
        if (result.fieldIssues?.length) {
          const nextErrors: Record<string, string> = {};
          for (const issue of result.fieldIssues) {
            nextErrors[issue.field] = issue.message;
          }
          setFieldErrors(nextErrors);
        }
        return;
      }

      syncFromServer(result.registration);
      setViewMode("submitted");
      router.replace("/register/review");
    });
  }

  function renderField(
    name: keyof RegistrationFormValues,
    options: {
      type?: string;
      inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
      autoComplete?: string;
      as?: "input" | "select";
    } = {},
  ) {
    const id = fieldId(formId, name);
    const error = fieldErrors[name];
    const describedBy = error ? `${id}-error` : undefined;
    const label = REGISTRATION_FIELD_LABELS[name];

    return (
      <div className="registration-field">
        <label htmlFor={id} className="registration-label">
          {label}
        </label>
        {options.as === "select" ? (
          <select
            id={id}
            name={name}
            className="registration-input"
            value={values[name]}
            disabled={isPending}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            autoComplete={options.autoComplete}
            onChange={(event) => updateField(name, event.target.value)}
          >
            <option value="">Select state</option>
            {US_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            name={name}
            className="registration-input"
            type={options.type ?? "text"}
            inputMode={options.inputMode}
            autoComplete={options.autoComplete}
            value={
              name === "mobilePhone"
                ? formatPhoneDisplay(values.mobilePhone) || values.mobilePhone
                : values[name]
            }
            disabled={isPending}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) => {
              if (name === "mobilePhone") {
                updateField(name, event.target.value.replace(/\D/g, "").slice(0, 10));
                return;
              }
              updateField(name, event.target.value);
            }}
          />
        )}
        {error ? (
          <p id={`${id}-error`} className="registration-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section className="registration-shell" aria-labelledby="registration-heading">
      <p className="registration-kicker">Holy Convocation registration</p>
      <h1 id="registration-heading" className="registration-title">
        {STEP_TITLES[currentStep]}
      </h1>
      <p className="registration-progress" aria-live="polite">
        Step {currentStep} of 4
      </p>

      {formError ? (
        <div
          id={errorSummaryId}
          className="registration-error-summary"
          role="alert"
          tabIndex={-1}
        >
          {formError}
        </div>
      ) : null}

      {currentStep === 1 ? (
        <div className="registration-fields">
          {renderField("firstName", { autoComplete: "given-name" })}
          {renderField("lastName", { autoComplete: "family-name" })}
          {renderField("email", {
            type: "email",
            inputMode: "email",
            autoComplete: "email",
          })}
          {renderField("mobilePhone", {
            type: "tel",
            inputMode: "tel",
            autoComplete: "tel",
          })}
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="registration-fields">
          {renderField("churchName", { autoComplete: "organization" })}
          {renderField("pastorName", { autoComplete: "name" })}
          {renderField("jurisdiction")}
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className="registration-fields">
          {renderField("streetAddress", { autoComplete: "street-address" })}
          {renderField("city", { autoComplete: "address-level2" })}
          {renderField("state", { as: "select", autoComplete: "address-level1" })}
          {renderField("postalCode", {
            inputMode: "numeric",
            autoComplete: "postal-code",
          })}
        </div>
      ) : null}

      {currentStep === 4 ? (
        <div className="registration-review">
          <dl className="registration-summary" aria-label="Review your information">
            {(Object.keys(REGISTRATION_FIELD_LABELS) as (keyof RegistrationFormValues)[]).map(
              (key) => (
                <div key={key}>
                  <dt>{REGISTRATION_FIELD_LABELS[key]}</dt>
                  <dd>
                    {key === "mobilePhone"
                      ? formatPhoneDisplay(values.mobilePhone) || values.mobilePhone || "—"
                      : values[key] || "—"}
                  </dd>
                </div>
              ),
            )}
          </dl>
          <div className="registration-edit-row">
            <Link href="/register?step=1" className="registration-btn registration-btn-secondary">
              Edit about you
            </Link>
            <Link href="/register?step=2" className="registration-btn registration-btn-secondary">
              Edit church
            </Link>
            <Link href="/register?step=3" className="registration-btn registration-btn-secondary">
              Edit address
            </Link>
          </div>
        </div>
      ) : null}

      <div className="registration-actions">
        {currentStep > 1 ? (
          <button
            type="button"
            className="registration-btn registration-btn-secondary"
            onClick={goBack}
            disabled={isPending}
          >
            Back
          </button>
        ) : (
          <Link
            href="/attendee-dashboard"
            className="registration-btn registration-btn-secondary"
          >
            Cancel
          </Link>
        )}

        {currentStep < 4 ? (
          <button
            type="button"
            className="registration-btn registration-btn-primary"
            onClick={() => continueFromStep(currentStep as 1 | 2 | 3)}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? "Saving…" : "Continue"}
          </button>
        ) : (
          <button
            type="button"
            className="registration-btn registration-btn-primary"
            onClick={handleSubmit}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? "Submitting…" : "Submit registration"}
          </button>
        )}
      </div>

      {isPending ? (
        <p className="registration-loading" role="status" aria-live="polite">
          Please wait…
        </p>
      ) : null}
    </section>
  );
}
