export type OwnerMutationDomain = "travel" | "registration";

const RETIRED_MANUAL_VERIFICATION_ACTIONS = new Set([
  "verify",
  "confirm",
  "mark_verified",
]);
const RETIRED_TRAVEL_ALIASES = new Set(["approve", "manual_confirm"]);

export type RetiredOwnerActionDisposition = {
  status: 410;
  code: "owner_verify_retired" | "registration_manual_transition_retired";
  error: string;
};

/**
 * Immutable retirement gate shared by owner mutation routes.
 * Authentication remains the first route boundary; this gate runs before any DB mutation.
 */
export function retiredOwnerActionDisposition(
  domain: OwnerMutationDomain,
  rawAction: unknown,
): RetiredOwnerActionDisposition | null {
  const action = String(rawAction ?? "").trim().toLowerCase();
  if (
    !RETIRED_MANUAL_VERIFICATION_ACTIONS.has(action) &&
    !(domain === "travel" && RETIRED_TRAVEL_ALIASES.has(action))
  ) {
    return null;
  }

  if (domain === "travel") {
    return {
      status: 410,
      code: "owner_verify_retired",
      error:
        "Owner verify/confirm is retired. Confirmed stays require a live supplier confirmation from paid checkout or supplier sync.",
    };
  }

  return {
    status: 410,
    code: "registration_manual_transition_retired",
    error:
      "Manual registration confirmation is retired. Registration state is controlled by atomic lifecycle RPCs and authoritative payment fulfillment.",
  };
}
