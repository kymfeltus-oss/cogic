"use client";

import type { ReactNode, Ref } from "react";
import Image from "next/image";
import Link from "next/link";
import { EXPERIENCE_BRAND_ASSETS } from "@/lib/experience/brand-assets";
import { cn } from "@/lib/utils";

type EmailGateShellProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  onBackNavigate?: () => void;
  shellRef?: Ref<HTMLDivElement>;
  /** Fluid pages scroll naturally; artboard pages scroll inside the mobile track shell. */
  layout?: "artboard" | "fluid";
  children: ReactNode;
};

/** Shared auth canvas — brand lockup header + form content. */
export default function EmailGateShell({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "Back",
  onBackNavigate,
  shellRef,
  layout = "artboard",
  children,
}: EmailGateShellProps) {
  return (
    <div
      ref={shellRef}
      className={cn(
        "relative flex w-full flex-col overflow-y-auto bg-brand-black pt-safe pb-safe text-white",
        layout === "fluid"
          ? "min-h-dvh"
          : "min-h-0 flex-1",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(0,168,255,0.1),transparent)]" />

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 py-4 md:px-6">
        {backHref ? (
          <Link
            href={backHref}
            onClick={onBackNavigate}
            className="mb-4 inline-flex min-h-11 items-center font-ui text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-muted transition hover:text-brand-blue"
          >
            ← {backLabel}
          </Link>
        ) : null}

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

          {eyebrow ? (
            <p className="mt-2 font-ui text-[0.54rem] font-bold uppercase tracking-[0.2em] text-brand-blue">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h1 className="mt-2 font-headline text-[clamp(1.3rem,4.8vw,1.65rem)] uppercase tracking-[0.08em] text-white">
              {title}
            </h1>
          ) : null}
          {description ? (
            <p className="mx-auto mt-2 max-w-sm font-body text-[0.82rem] leading-snug text-brand-muted">
              {description}
            </p>
          ) : null}
        </header>

        <div className="glass-panel flex flex-1 flex-col rounded-2xl border border-brand-border p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function gateFieldClass(_isValid: boolean, _isInvalid: boolean): string {
  void _isValid;
  void _isInvalid;
  return "w-full min-h-11 rounded-xl border border-brand-border bg-brand-panel/80 px-4 py-2.5 font-body text-sm text-white outline-none transition placeholder:text-brand-muted/45 focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/25";
}

export function ValidationHint({
  valid,
  invalid,
  validMessage,
  invalidMessage,
}: {
  valid: boolean;
  invalid: boolean;
  validMessage: string;
  invalidMessage: string;
}) {
  if (!valid && !invalid) return null;

  return (
    <p className="mt-1 font-body text-xs text-brand-muted">{valid ? validMessage : invalidMessage}</p>
  );
}

export function PrimaryGateButton({
  children,
  disabled,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="touch-target flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-pink/40 bg-brand-pink/15 px-4 py-2.5 font-ui text-[0.62rem] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-brand-pink/25 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SecondaryGateButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="touch-target flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-panel/60 px-4 py-2.5 font-ui text-[0.62rem] font-bold uppercase tracking-[0.1em] text-brand-muted transition hover:border-brand-blue/30 hover:text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}
