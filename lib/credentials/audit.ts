import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";

export type CredentialAuditAction =
  | "credential.issued"
  | "credential.activated"
  | "credential.rotated"
  | "credential.revoked";

/**
 * Optional application-layer audit helper.
 * Primary audit writes occur inside SECURITY DEFINER RPCs.
 * Never include tokens or token hashes in metadata.
 */
export async function writeCredentialAuditEvent(input: {
  action: CredentialAuditAction;
  credentialId: string;
  userId: string | null;
  userEmail: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("audit_logs").insert({
    tenant_id: "300-awakening",
    user_id: input.userId,
    user_email: input.userEmail,
    action: input.action,
    target_type: "registration_credential",
    target_id: input.credentialId,
    metadata: {
      program_key: "cogic-stream-2026",
      ...(input.metadata ?? {}),
    },
  });

  if (error) {
    console.error("[CREDENTIAL_AUDIT_ERR]:", error.message);
  }
}
