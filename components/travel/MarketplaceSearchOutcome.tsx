"use client";

import Link from "next/link";
import type { MarketplaceSearchCode } from "@/lib/travel/marketplace/types";

type Props = {
  code: MarketplaceSearchCode | null;
  reason?: string;
  showOfficialHotelsLink?: boolean;
};

export default function MarketplaceSearchOutcome({
  code,
  reason,
  showOfficialHotelsLink = false,
}: Props) {
  if (!code) return null;

  const title =
    code === "provider_not_configured"
      ? "Live marketplace inventory is temporarily unavailable"
      : code === "provider_unavailable"
        ? "Marketplace provider temporarily unavailable"
        : code === "zero_results"
          ? "No matching marketplace offers"
          : code === "validation_error"
            ? "Check your search details"
            : null;

  if (!title && code === "results") return null;

  return (
    <div className="ct-honest-hint" role={code === "validation_error" ? "alert" : undefined}>
      {title ? <strong className="block">{title}</strong> : null}
      <p>{reason || "Unable to complete that marketplace search."}</p>
      {showOfficialHotelsLink &&
      (code === "provider_not_configured" ||
        code === "provider_unavailable" ||
        code === "zero_results") ? (
        <p>
          <Link href="/travel/hotels" className="underline">
            Browse official COGIC negotiated hotels
          </Link>
        </p>
      ) : null}
    </div>
  );
}
