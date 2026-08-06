"use client";

import { Loader2, Mail, Send } from "lucide-react";
import type { FormEvent } from "react";
import { isSupportEmailConfigured, PRAYER_CONTACT } from "@/lib/prayer/contact";

export type ContactUsFormValues = {
  fullName: string;
  email: string;
  subject: string;
  message: string;
};

type ContactUsFormProps = {
  values: ContactUsFormValues;
  isSubmitting: boolean;
  canSubmit: boolean;
  formError?: string | null;
  onFieldChange: <K extends keyof ContactUsFormValues>(
    key: K,
    value: ContactUsFormValues[K],
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const fieldClassName =
  "w-full rounded-xl border border-brand-border bg-brand-panel/80 px-4 py-3 font-body text-sm text-white outline-none transition placeholder:text-brand-muted/50 focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/30";

export default function ContactUsForm({
  values,
  isSubmitting,
  canSubmit,
  formError,
  onFieldChange,
  onSubmit,
}: ContactUsFormProps) {
  return (
    <div className="contact-us-form-wrap w-full">
      <form
        onSubmit={onSubmit}
        className="glass-panel w-full rounded-2xl border border-brand-border p-5 sm:p-6"
        aria-label="Contact us"
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-1">
            <span className="mb-1.5 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
              Full name
            </span>
            <input
              type="text"
              required
              autoComplete="name"
              value={values.fullName}
              onChange={(event) => onFieldChange("fullName", event.target.value)}
              className={fieldClassName}
              placeholder="Your name"
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="mb-1.5 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={values.email}
              onChange={(event) => onFieldChange("email", event.target.value)}
              className={fieldClassName}
              placeholder="you@example.com"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
            Subject
          </span>
          <input
            type="text"
            required
            value={values.subject}
            onChange={(event) => onFieldChange("subject", event.target.value)}
            className={fieldClassName}
            placeholder="How can we help?"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
            Message
          </span>
          <textarea
            required
            rows={5}
            value={values.message}
            onChange={(event) => onFieldChange("message", event.target.value)}
            className={`${fieldClassName} min-h-32 resize-y`}
            placeholder="Tell us what's on your mind…"
          />
        </label>

        {formError ? (
          <p role="alert" className="mt-4 font-body text-sm text-brand-pink">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="touch-target mt-5 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-blue/40 bg-brand-blue/10 px-6 font-ui text-[0.65rem] font-bold uppercase tracking-[0.16em] text-brand-blue transition hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Opening mail…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden="true" />
              Send message
            </>
          )}
        </button>
      </form>

      {isSupportEmailConfigured ? (
        <div className="mt-8 text-center">
          <p className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.2em] text-brand-muted">
            Or reach us directly
          </p>
          <a
            href={PRAYER_CONTACT.emailMailto}
            className="touch-target mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-panel/60 px-5 font-body text-sm text-white transition hover:border-brand-pink/40 hover:text-brand-pink"
          >
            <Mail className="size-4 text-brand-blue" aria-hidden="true" />
            {PRAYER_CONTACT.email}
          </a>
        </div>
      ) : (
        <p className="mt-8 text-center font-body text-sm text-brand-muted" role="status">
          Support email is not configured yet (NEXT_PUBLIC_SUPPORT_EMAIL).
        </p>
      )}
    </div>
  );
}
