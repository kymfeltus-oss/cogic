"use client";

import { Check, ChevronRight, Loader2, Lock } from "lucide-react";
import { seedPackages, type SeedPackageId } from "@/lib/seeds/assets";

type BuySeedsNativeFormProps = {
  selectedPackageId: SeedPackageId;
  isSubmitting: boolean;
  activePackageId: SeedPackageId | null;
  errorMessage: string | null;
  onSelectPackage: (packageId: SeedPackageId) => void;
  onContinue: () => void;
};

function badgeClassName(badge: string): string {
  if (badge === "BEST VALUE") {
    return "border-brand-purple/40 bg-brand-purple/10 text-brand-purple";
  }
  if (badge.startsWith("SAVE")) {
    return "border-brand-blue/40 bg-brand-blue/10 text-brand-blue";
  }
  return "border-brand-pink/40 bg-brand-pink/10 text-brand-pink";
}

function packageRowClassName(isSelected: boolean): string {
  return [
    "relative touch-target flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition font-ui",
    isSelected
      ? "border-brand-blue/50 bg-brand-panel shadow-[0_0_22px_rgba(0,168,255,0.28),0_0_28px_rgba(255,0,140,0.12)]"
      : "border-brand-border bg-brand-panel/80 hover:border-brand-blue/30",
  ].join(" ");
}

export default function BuySeedsNativeForm({
  selectedPackageId,
  isSubmitting,
  activePackageId,
  errorMessage,
  onSelectPackage,
  onContinue,
}: BuySeedsNativeFormProps) {
  return (
    <div className="flex flex-col gap-2">
      <section aria-label="Choose a seed package" className="space-y-1.5">
        <h2 className="mb-1 text-center font-ui text-[0.56rem] font-bold uppercase tracking-[0.24em] text-white">
          Choose a package
        </h2>

        <div role="radiogroup" aria-label="Choose a seed package" className="space-y-1.5">
          {seedPackages.map((pkg) => {
            const isSelected = selectedPackageId === pkg.packageId;
            const isActive = isSubmitting && activePackageId === pkg.packageId;

            return (
              <button
                key={pkg.packageId}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${pkg.seeds} Seeds — ${pkg.badge} — ${pkg.price}`}
                disabled={isSubmitting}
                aria-busy={isActive}
                onClick={() => onSelectPackage(pkg.packageId)}
                className={packageRowClassName(isSelected)}
              >
                {isSelected ? (
                  <span
                    className="absolute left-1.5 top-1/2 flex size-3.5 -translate-y-1/2 items-center justify-center rounded-full bg-brand-blue text-white"
                    aria-hidden="true"
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                ) : null}

                <span className="min-w-0 flex-1 pl-5 font-body text-sm font-semibold text-white">
                  {pkg.seeds.toLocaleString()} Seeds
                </span>

                <span
                  className={`shrink-0 rounded-full border px-1.5 py-0.5 font-ui text-[0.48rem] font-bold uppercase tracking-[0.1em] ${badgeClassName(pkg.badge)}`}
                >
                  {pkg.badge}
                </span>

                <span className="shrink-0 font-body text-sm font-bold tabular-nums text-white">
                  {pkg.price}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="shrink-0 space-y-2 border-t border-brand-border/30 pt-2">
        {errorMessage ? (
          <p
            role="alert"
            className="rounded-lg border border-brand-pink/30 bg-brand-pink/10 px-3 py-1.5 font-body text-xs text-brand-pink"
          >
            {errorMessage}
          </p>
        ) : null}

        <button
          type="button"
          disabled={isSubmitting || !selectedPackageId}
          aria-busy={isSubmitting}
          onClick={onContinue}
          className="touch-target inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-blue/40 bg-brand-blue/10 px-6 font-ui text-[0.65rem] font-bold uppercase tracking-[0.16em] text-brand-blue transition hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Preparing checkout…
            </>
          ) : (
            <>
              <Lock className="size-4" aria-hidden="true" strokeWidth={2.25} />
              Continue to Payment
              <ChevronRight className="size-4" aria-hidden="true" strokeWidth={2.5} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
