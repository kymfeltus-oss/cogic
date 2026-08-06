import type { SafeCredentialResolution } from "@/lib/credentials/types";

export type PublicCredentialView =
  | { kind: "available"; resolution: ResolvedPublicCredential }
  | { kind: "unavailable" };

/** Safe fields allowed on the public /c page after session validation. */
export type ResolvedPublicCredential = {
  status: "issued" | "active";
  badgeCode: string | null;
  firstName: string | null;
  churchName: string | null;
  jurisdiction: string | null;
  programKey: string | null;
};

const RESOLVED_PUBLIC_FIELDS = [
  "status",
  "badgeCode",
  "firstName",
  "churchName",
  "jurisdiction",
  "programKey",
] as const satisfies readonly (keyof ResolvedPublicCredential)[];

export function resolvedPublicFieldAllowlist(): readonly string[] {
  return RESOLVED_PUBLIC_FIELDS;
}

export function shouldIssueCredentialSession(
  resolution: SafeCredentialResolution,
): resolution is SafeCredentialResolution & {
  outcome: "resolved";
  status: "issued" | "active";
} {
  return (
    resolution.outcome === "resolved" &&
    (resolution.status === "issued" || resolution.status === "active")
  );
}

/** Collapse invalid, rotated, revoked, expired, and unavailable into one public state. */
export function collapseToPublicView(
  resolution: SafeCredentialResolution | null | undefined,
): PublicCredentialView {
  if (!resolution || !shouldIssueCredentialSession(resolution)) {
    return { kind: "unavailable" };
  }

  return {
    kind: "available",
    resolution: {
      status: resolution.status,
      badgeCode: resolution.badgeCode,
      firstName: resolution.firstName,
      churchName: resolution.churchName,
      jurisdiction: resolution.jurisdiction,
      programKey: resolution.programKey,
    },
  };
}

export function toSessionPayload(
  resolution: SafeCredentialResolution & {
    outcome: "resolved";
    status: "issued" | "active";
  },
): ResolvedPublicCredential {
  return {
    status: resolution.status,
    badgeCode: resolution.badgeCode,
    firstName: resolution.firstName,
    churchName: resolution.churchName,
    jurisdiction: resolution.jurisdiction,
    programKey: resolution.programKey,
  };
}
