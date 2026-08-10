import { NextResponse } from "next/server";
import { MarketplaceValidationError } from "./search";
import type { MarketplaceSearchResponse } from "./types";

export function marketplaceSearchHttpStatus(result: MarketplaceSearchResponse<unknown>) {
  if (result.code === "provider_not_configured") return 503;
  if (result.code === "provider_unavailable") return 502;
  return 200;
}

export function marketplaceSearchErrorResponse(error: unknown) {
  if (error instanceof MarketplaceValidationError) {
    return NextResponse.json(
      { error: error.message, code: "validation_error", available: false, offers: [] },
      { status: 400 },
    );
  }
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "Search failed.",
      code: "validation_error",
      available: false,
      offers: [],
    },
    { status: 400 },
  );
}
