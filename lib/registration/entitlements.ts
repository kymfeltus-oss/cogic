export const ENTITLEMENT_TYPES = [
  "event_access", "seating", "housing", "content", "item", "badge", "discount",
] as const;

export type EntitlementType = (typeof ENTITLEMENT_TYPES)[number];

export type AccessEntitlement = {
  id: string;
  key: string;
  name: string;
  type: EntitlementType;
  active: boolean;
  eventType: string | null;
  eventId: string | null;
  eventOccurrenceId: string | null;
  venueKey: string | null;
  accessZone: string | null;
  validFrom: string | null;
  validUntil: string | null;
  preferredHoldMinutes: number | null;
  usageLimit: number | null;
  singleUse: boolean;
  guardianRequired: boolean;
};

export type OwnedEntitlement = AccessEntitlement & {
  status: "pending" | "active" | "consumed" | "expired" | "revoked";
  quantity: number;
  usesConsumed: number;
  guardianRegistrationId: string | null;
};

export const ACCESS_REASON_CODES = [
  "VALID_REGISTRATION", "VALID_TICKET", "PREFERRED_SEATING", "GENERAL_SEATING",
  "PREFERRED_SEATING_WINDOW_EXPIRED", "WRONG_EVENT", "TICKET_ALREADY_USED",
  "REGISTRATION_CANCELED", "PAYMENT_NOT_CONFIRMED", "CREDENTIAL_REVOKED",
  "GUARDIAN_REQUIRED", "ENTITLEMENT_EXPIRED", "NO_APPLICABLE_ENTITLEMENT",
] as const;
export type AccessReasonCode = (typeof ACCESS_REASON_CODES)[number];

export type AccessDecision = {
  result: "ALLOWED" | "DENIED" | "ALLOWED_WITH_CONDITION";
  reasonCode: AccessReasonCode;
  accessZone: string | null;
  entitlementId: string | null;
  preferredUntil: string | null;
};

export type ResolveAttendeeAccessInput = {
  registrationStatus: string;
  credentialStatus: string;
  eventOccurrence: { id: string; eventId: string; eventType: string; venueKey?: string | null; startsAt: string };
  entitlements: OwnedEntitlement[];
  currentTime: string | Date;
  guardianPresent?: boolean;
};

function applies(entitlement: OwnedEntitlement, occurrence: ResolveAttendeeAccessInput["eventOccurrence"]) {
  if (entitlement.eventOccurrenceId && entitlement.eventOccurrenceId !== occurrence.id) return false;
  if (entitlement.eventId && entitlement.eventId !== occurrence.eventId) return false;
  if (entitlement.eventType && entitlement.eventType !== occurrence.eventType) return false;
  if (entitlement.venueKey && entitlement.venueKey !== occurrence.venueKey) return false;
  return true;
}

export function resolveAttendeeAccess(input: ResolveAttendeeAccessInput): AccessDecision {
  if (input.credentialStatus !== "active") return { result: "DENIED", reasonCode: "CREDENTIAL_REVOKED", accessZone: null, entitlementId: null, preferredUntil: null };
  if (input.registrationStatus !== "confirmed") return { result: "DENIED", reasonCode: input.registrationStatus === "canceled" ? "REGISTRATION_CANCELED" : "PAYMENT_NOT_CONFIRMED", accessZone: null, entitlementId: null, preferredUntil: null };

  const now = new Date(input.currentTime).getTime();
  const scoped = input.entitlements.filter((item) => item.active && applies(item, input.eventOccurrence));
  for (const item of scoped) {
    if (item.status === "consumed" || (item.singleUse && item.usageLimit !== null && item.usesConsumed >= item.usageLimit)) continue;
    if (item.guardianRequired && !input.guardianPresent) return { result: "DENIED", reasonCode: "GUARDIAN_REQUIRED", accessZone: null, entitlementId: item.id, preferredUntil: null };
    if ((item.validFrom && now < Date.parse(item.validFrom)) || (item.validUntil && now > Date.parse(item.validUntil))) continue;
    if (item.type !== "event_access" && item.type !== "seating") continue;
    if (item.type === "seating" && item.preferredHoldMinutes !== null) {
      const preferredUntil = new Date(Date.parse(input.eventOccurrence.startsAt) + item.preferredHoldMinutes * 60_000).toISOString();
      if (now <= Date.parse(preferredUntil)) return { result: "ALLOWED", reasonCode: "PREFERRED_SEATING", accessZone: item.accessZone, entitlementId: item.id, preferredUntil };
      const general = scoped.find((candidate) => candidate.type === "event_access" && candidate.status === "active");
      if (general) return { result: "ALLOWED_WITH_CONDITION", reasonCode: "PREFERRED_SEATING_WINDOW_EXPIRED", accessZone: general.accessZone, entitlementId: general.id, preferredUntil };
    }
    return { result: "ALLOWED", reasonCode: item.accessZone === "general" ? "GENERAL_SEATING" : "VALID_REGISTRATION", accessZone: item.accessZone, entitlementId: item.id, preferredUntil: null };
  }
  if (scoped.some((item) => item.status === "consumed")) return { result: "DENIED", reasonCode: "TICKET_ALREADY_USED", accessZone: null, entitlementId: null, preferredUntil: null };
  if (scoped.some((item) => item.validUntil && now > Date.parse(item.validUntil))) return { result: "DENIED", reasonCode: "ENTITLEMENT_EXPIRED", accessZone: null, entitlementId: null, preferredUntil: null };
  return { result: "DENIED", reasonCode: "NO_APPLICABLE_ENTITLEMENT", accessZone: null, entitlementId: null, preferredUntil: null };
}
