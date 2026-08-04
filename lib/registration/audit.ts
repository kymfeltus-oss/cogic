import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";

export type RegistrationAuditAction =
  | "registration.draft_created"
  | "registration.draft_updated"
  | "registration.submitted";

export async function writeRegistrationAuditEvent(input: {
  action: RegistrationAuditAction;
  registrationId: string;
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
    target_type: "registration",
    target_id: input.registrationId,
    metadata: {
      program_key: "cogic-stream-2026",
      ...(input.metadata ?? {}),
    },
  });

  if (error) {
    console.error("[REGISTRATION_AUDIT_ERR]:", error.message);
  }
}
