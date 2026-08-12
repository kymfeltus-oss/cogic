/**
 * Server-authority helpers for travel checkout.
 * Client money / identity / snapshot fields are never accepted as charge authority.
 * Keep this module free of `server-only` so runtime tests can import it safely.
 */

export function hasForbiddenClientCheckoutAuthority(
  body: Record<string, unknown>,
  mode: "create" | "resume" = "create",
) {
  const moneyOrIdentity =
    body.userId != null ||
    body.status != null ||
    body.amountCents != null ||
    body.totalAmountCents != null ||
    body.fareCents != null ||
    body.taxAmountCents != null ||
    body.serviceFeeCents != null ||
    body.paymentIntentId != null ||
    body.taxProfileId != null ||
    body.tax_profile_id != null ||
    body.verification_status != null ||
    body.verificationStatus != null ||
    body.taxExemptVerified != null ||
    body.tax_exempt_verified != null;

  if (mode === "resume") {
    return (
      moneyOrIdentity ||
      body.clientSecret != null ||
      body.offer != null ||
      body.offerSnapshot != null
    );
  }
  return moneyOrIdentity;
}

/** Early gate used by create-intent / resume routes (and runtime tests). */
export function evaluateCheckoutAuthorityGate(
  body: unknown,
  mode: "create" | "resume",
): { ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      status: 400,
      error: mode === "resume" ? "Invalid resume payload." : "Invalid checkout payload.",
    };
  }
  const record = body as Record<string, unknown>;
  if (hasForbiddenClientCheckoutAuthority(record, mode)) {
    return {
      ok: false,
      status: 400,
      error:
        mode === "resume"
          ? "Client cannot set user identity, travel_transaction_status, PaymentIntent fields, offer snapshot, or charged amounts."
          : "Client cannot set user identity, travel_transaction_status, PaymentIntent id, or charged amounts.",
    };
  }
  if (mode === "resume") {
    const attemptId = String(record.attemptId || record.attempt_id || "").trim();
    if (!attemptId) {
      return { ok: false, status: 400, error: "attemptId is required." };
    }
  }
  return { ok: true, body: record };
}

/**
 * Live provider fare wins. Client offer money fields are intentionally ignored.
 */
export function selectAuthoritativeFareCents(
  liveFareCents: number,
  clientOffer?: Record<string, unknown> | null,
) {
  if (!Number.isFinite(liveFareCents) || liveFareCents <= 0) {
    throw new Error("Live provider fare is required for checkout.");
  }
  // Touch client offer only to prove we do not trust its money fields.
  void Number(
    clientOffer?.totalRateCents ??
      clientOffer?.totalFareCents ??
      clientOffer?.totalAmountCents ??
      clientOffer?.fareCents ??
      NaN,
  );
  return Math.round(liveFareCents);
}

export function assertExactBookTokenMatch(
  requested: string,
  liveToken: string,
  kind: "hotel" | "car",
) {
  const requestedToken = String(requested || "").trim();
  const authoritative = String(liveToken || "").trim();
  if (!requestedToken || !authoritative || requestedToken !== authoritative) {
    throw new Error(
      kind === "hotel"
        ? "Expedia bookToken divergence detected. Rate is no longer valid."
        : "Expedia car bookToken divergence detected. Rate is no longer valid.",
    );
  }
  return authoritative;
}
