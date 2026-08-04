import "server-only";

import {
  CredentialError,
  mapCredentialDatabaseError,
} from "@/lib/credentials/errors";
import {
  generateBadgeCode,
  generateCredentialToken,
  hashCredentialToken,
  isValidCredentialToken,
  credentialTokenHashHex,
} from "@/lib/credentials/token";
import type {
  CredentialIssueResult,
  CredentialMutationResult,
  CredentialRotateResult,
  CredentialStatus,
  SafeCredentialResolution,
  UsableCredentialStatus,
} from "@/lib/credentials/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type RpcIssueRow = {
  ok?: boolean;
  credential_id?: string;
  registration_id?: string;
  credential_version?: number;
  status?: CredentialStatus;
  badge_code?: string;
  issued_at?: string;
  activated_at?: string | null;
  expires_at?: string | null;
};

type RpcRotateRow = {
  ok?: boolean;
  previous_credential_id?: string;
  credential_id?: string;
  credential_version?: number;
  status?: CredentialStatus;
  badge_code?: string;
  rotated_at?: string;
};

type RpcMutationRow = {
  ok?: boolean;
  credential_id?: string;
  status?: CredentialStatus;
  activated_at?: string | null;
  revoked_at?: string | null;
};

type RpcResolveRow = {
  outcome?: string;
  status?: string;
  badge_code?: string | null;
  first_name?: string | null;
  church_name?: string | null;
  jurisdiction?: string | null;
  program_key?: string | null;
};

function requireRegistrationId(registrationId: string): string {
  const trimmed = registrationId.trim();
  if (!trimmed) {
    throw new CredentialError("validation", "Registration id is required.");
  }
  return trimmed;
}

function mapSafeResolution(row: RpcResolveRow | null): SafeCredentialResolution {
  const outcome = (row?.outcome ?? "invalid") as SafeCredentialResolution["outcome"];
  const status =
    row?.status === "issued" || row?.status === "active"
      ? (row.status as UsableCredentialStatus)
      : undefined;

  return {
    outcome,
    status,
    badgeCode: row?.badge_code ?? null,
    firstName: row?.first_name ?? null,
    churchName: row?.church_name ?? null,
    jurisdiction: row?.jurisdiction ?? null,
    programKey: row?.program_key ?? null,
  };
}

/**
 * Issue a credential for a confirmed registration.
 * Raw token is returned once to the caller and never persisted.
 */
export async function issueRegistrationCredential(input: {
  registrationId: string;
  actorUserId?: string | null;
  expiresAt?: string | null;
  activate?: boolean;
}): Promise<CredentialIssueResult> {
  const registrationId = requireRegistrationId(input.registrationId);
  const rawToken = generateCredentialToken();
  const tokenHashHex = credentialTokenHashHex(rawToken);
  const badgeCode = generateBadgeCode();
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.rpc("issue_registration_credential", {
    p_registration_id: registrationId,
    p_token_hash_hex: tokenHashHex,
    p_badge_code: badgeCode,
    p_actor_user_id: input.actorUserId ?? null,
    p_expires_at: input.expiresAt ?? null,
    p_activate: input.activate === true,
  });

  if (error) {
    throw mapCredentialDatabaseError(error);
  }

  const row = data as RpcIssueRow;
  if (!row?.ok || !row.credential_id) {
    throw new CredentialError("unavailable", "Credential issuance failed.");
  }

  return {
    ok: true,
    credentialId: row.credential_id,
    registrationId: row.registration_id ?? registrationId,
    credentialVersion: Number(row.credential_version),
    status: row.status as CredentialStatus,
    badgeCode: row.badge_code ?? badgeCode,
    issuedAt: row.issued_at ?? new Date().toISOString(),
    activatedAt: row.activated_at ?? null,
    expiresAt: row.expires_at ?? null,
    rawTokenOnce: rawToken,
  };
}

export async function activateRegistrationCredential(input: {
  credentialId: string;
  actorUserId?: string | null;
}): Promise<CredentialMutationResult> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("activate_registration_credential", {
    p_credential_id: input.credentialId,
    p_actor_user_id: input.actorUserId ?? null,
  });

  if (error) {
    throw mapCredentialDatabaseError(error);
  }

  const row = data as RpcMutationRow;
  if (!row?.ok || !row.credential_id) {
    throw new CredentialError("unavailable", "Credential activation failed.");
  }

  return {
    ok: true,
    credentialId: row.credential_id,
    status: row.status as CredentialStatus,
    activatedAt: row.activated_at ?? null,
  };
}

export async function rotateRegistrationCredential(input: {
  registrationId: string;
  actorUserId?: string | null;
  expiresAt?: string | null;
  activate?: boolean;
}): Promise<CredentialRotateResult> {
  const registrationId = requireRegistrationId(input.registrationId);
  const rawToken = generateCredentialToken();
  const tokenHashHex = credentialTokenHashHex(rawToken);
  const badgeCode = generateBadgeCode();
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.rpc("rotate_registration_credential", {
    p_registration_id: registrationId,
    p_token_hash_hex: tokenHashHex,
    p_badge_code: badgeCode,
    p_actor_user_id: input.actorUserId ?? null,
    p_expires_at: input.expiresAt ?? null,
    p_activate: input.activate !== false,
  });

  if (error) {
    throw mapCredentialDatabaseError(error);
  }

  const row = data as RpcRotateRow;
  if (!row?.ok || !row.credential_id) {
    throw new CredentialError("unavailable", "Credential rotation failed.");
  }

  return {
    ok: true,
    previousCredentialId: row.previous_credential_id ?? "",
    credentialId: row.credential_id,
    credentialVersion: Number(row.credential_version),
    status: row.status as CredentialStatus,
    badgeCode: row.badge_code ?? badgeCode,
    rotatedAt: row.rotated_at ?? new Date().toISOString(),
    rawTokenOnce: rawToken,
  };
}

export async function revokeRegistrationCredential(input: {
  credentialId: string;
  reason?: string | null;
  actorUserId?: string | null;
}): Promise<CredentialMutationResult> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("revoke_registration_credential", {
    p_credential_id: input.credentialId,
    p_reason: input.reason ?? null,
    p_actor_user_id: input.actorUserId ?? null,
  });

  if (error) {
    throw mapCredentialDatabaseError(error);
  }

  const row = data as RpcMutationRow;
  if (!row?.ok || !row.credential_id) {
    throw new CredentialError("unavailable", "Credential revocation failed.");
  }

  return {
    ok: true,
    credentialId: row.credential_id,
    status: row.status as CredentialStatus,
    revokedAt: row.revoked_at ?? null,
  };
}

/**
 * Resolve a bearer token to a sanitized DTO.
 * Rejects malformed/oversized input before hashing.
 */
export async function resolveRegistrationCredential(
  rawToken: string,
): Promise<SafeCredentialResolution> {
  if (
    typeof rawToken !== "string" ||
    rawToken.length > 64 ||
    !isValidCredentialToken(rawToken)
  ) {
    return {
      outcome: "invalid",
      badgeCode: null,
      firstName: null,
      churchName: null,
      jurisdiction: null,
      programKey: null,
    };
  }

  // Ensure hash path uses the validated token only (no logging).
  hashCredentialToken(rawToken);
  const tokenHashHex = credentialTokenHashHex(rawToken);
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.rpc("resolve_registration_credential", {
    p_token_hash_hex: tokenHashHex,
  });

  if (error) {
    throw mapCredentialDatabaseError(error);
  }

  return mapSafeResolution(data as RpcResolveRow);
}
