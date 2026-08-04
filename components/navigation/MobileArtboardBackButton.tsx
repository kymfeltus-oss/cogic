"use client";

import Link from "next/link";
import { ChevronLeft, X } from "lucide-react";
import {
  ATTENDEE_DASHBOARD_PATH,
  MOBILE_ARTBOARD_BACK_HOTSPOT,
} from "@/lib/navigation/back-to-dashboard";
import type { CSSProperties } from "react";

type MobileArtboardBackButtonProps = {
  href?: string;
  label?: string;
  variant?: "back" | "close";
  className?: string;
};

export default function MobileArtboardBackButton({
  href = ATTENDEE_DASHBOARD_PATH,
  label = MOBILE_ARTBOARD_BACK_HOTSPOT.label,
  variant = "back",
  className = "",
}: MobileArtboardBackButtonProps) {
  const Icon = variant === "close" ? X : ChevronLeft;

  return (
    <Link
      href={href}
      aria-label={label}
      className={`mobile-artboard-back-btn touch-target pointer-events-auto ${className}`.trim()}
      style={
        {
          left: MOBILE_ARTBOARD_BACK_HOTSPOT.left,
          top: MOBILE_ARTBOARD_BACK_HOTSPOT.top,
          width: MOBILE_ARTBOARD_BACK_HOTSPOT.width,
          height: MOBILE_ARTBOARD_BACK_HOTSPOT.height,
        } as CSSProperties
      }
    >
      <Icon className="mobile-artboard-back-btn__icon" aria-hidden="true" strokeWidth={2.5} />
    </Link>
  );
}
