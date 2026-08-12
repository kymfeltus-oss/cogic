import "server-only";

export const TRAVEL_CHECKOUT_TYPE = "travel_marketplace" as const;

export function travelServiceFeeCents(subtotalCents: number) {
  const bpsRaw = Number(process.env.TRAVEL_SERVICE_FEE_BPS || "0");
  const bps = Number.isFinite(bpsRaw) && bpsRaw > 0 ? Math.min(bpsRaw, 2500) : 0;
  const flatRaw = Number(process.env.TRAVEL_SERVICE_FEE_CENTS || "0");
  const flat = Number.isFinite(flatRaw) && flatRaw > 0 ? Math.round(flatRaw) : 0;
  const percentFee = Math.round((Math.max(0, subtotalCents) * bps) / 10_000);
  return Math.max(0, percentFee + flat);
}
