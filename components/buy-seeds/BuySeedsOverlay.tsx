"use client";

import {
  BUY_SEEDS_BAKED_CONTROLS_MASK,
  BUY_SEEDS_CONTINUE_SLOT,
  BUY_SEEDS_ERROR_SLOT,
  BUY_SEEDS_PACKAGES_PANEL,
  seedPackages,
  type SeedPackageId,
} from "@/lib/seeds/assets";
import { ChevronRight, Lock } from "lucide-react";
import type { CSSProperties } from "react";

type BuySeedsOverlayProps = {
  selectedPackageId: SeedPackageId;
  isSubmitting: boolean;
  activePackageId: SeedPackageId | null;
  errorMessage: string | null;
  onSelectPackage: (packageId: SeedPackageId) => void;
  onContinue: () => void;
};

function badgeClassName(badge: string): string {
  if (badge === "BEST VALUE") {
    return "text-brand-purple";
  }
  if (badge.startsWith("SAVE")) {
    return "text-brand-blue";
  }
  return "text-brand-pink";
}

function rectStyle(rect: {
  left: string;
  top: string;
  width: string;
  height: string;
}) {
  return {
    position: "absolute" as const,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export default function BuySeedsOverlay({
  selectedPackageId,
  isSubmitting,
  activePackageId,
  errorMessage,
  onSelectPackage,
  onContinue,
}: BuySeedsOverlayProps) {
  return (
    <div
      className="buy-seeds-page__overlay"
      aria-label="Buy Vital Seeds"
      style={
        {
          "--buy-seeds-baked-mask-top": BUY_SEEDS_BAKED_CONTROLS_MASK.top,
          "--buy-seeds-baked-mask-height": BUY_SEEDS_BAKED_CONTROLS_MASK.height,
          "--buy-seeds-packages-panel-top": BUY_SEEDS_PACKAGES_PANEL.top,
          "--buy-seeds-packages-panel-height": BUY_SEEDS_PACKAGES_PANEL.height,
        } as CSSProperties
      }
    >
      <div className="buy-seeds-page__baked-mask" aria-hidden="true" />
      <div className="buy-seeds-page__secure-copy-mask" aria-hidden="true" />

      <div
        className="buy-seeds-page__packages-panel pointer-events-auto"
        role="radiogroup"
        aria-label="Choose a seed package"
      >
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
              className={`buy-seeds-package-row font-ui${
                isSelected ? " buy-seeds-package-row--selected" : ""
              }`}
            >
              <span
                className={
                  isSelected
                    ? "buy-seeds-package-row__radio buy-seeds-package-row__radio--selected"
                    : "buy-seeds-package-row__radio buy-seeds-package-row__radio--idle"
                }
                aria-hidden="true"
              >
                {isSelected ? <span className="buy-seeds-package-row__radio-dot" /> : null}
              </span>

              <span className="buy-seeds-package-row__seeds font-ui">
                {pkg.seeds.toLocaleString()} Seeds
              </span>

              <span
                className={`buy-seeds-package-row__badge font-ui uppercase tracking-wide ${badgeClassName(pkg.badge)}`}
              >
                {pkg.badge}
              </span>

              <span className="buy-seeds-package-row__price font-ui">{pkg.price}</span>
            </button>
          );
        })}
      </div>

      {errorMessage ? (
        <p
          className="buy-seeds-page__inline-error font-body"
          role="alert"
          style={rectStyle(BUY_SEEDS_ERROR_SLOT)}
        >
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        aria-label={BUY_SEEDS_CONTINUE_SLOT.label}
        disabled={isSubmitting || !selectedPackageId}
        aria-busy={isSubmitting}
        onClick={onContinue}
        style={rectStyle(BUY_SEEDS_CONTINUE_SLOT)}
        className={`buy-seeds-continue-btn pointer-events-auto font-ui${
          isSubmitting ? " buy-seeds-continue-btn--loading" : ""
        }`}
      >
        <Lock className="buy-seeds-continue-btn__icon" aria-hidden="true" strokeWidth={2.25} />
        <span className="buy-seeds-continue-btn__label">Continue to Payment</span>
        <ChevronRight className="buy-seeds-continue-btn__icon" aria-hidden="true" strokeWidth={2.5} />
      </button>
    </div>
  );
}
