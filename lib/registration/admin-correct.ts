import "server-only";

import { sanitizeRegistrationCorrectionInput } from "@/lib/registration/admin-correct-sanitize";
import { mapDatabaseError, RegistrationError } from "@/lib/registration/errors";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export {
  REGISTRATION_CORRECTION_ALLOWLIST,
  sanitizeRegistrationCorrectionInput,
  type RegistrationCorrectionField,
} from "@/lib/registration/admin-correct-sanitize";

export type RegistrationCorrectionResult = {
  registrationId: string;
  rowVersion: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobilePhone: string | null;
  preferredLanguage: string | null;
  requiresInterpretation: boolean;
  dateOfBirth: string | null;
  status: string;
  amountCents: number | null;
};

function requireReason(reason: string): string {
  const cleaned = reason.trim();
  if (cleaned.length < 8) {
    throw new RegistrationError(
      "validation",
      "A correction audit reason of at least 8 characters is required.",
    );
  }
  return cleaned.slice(0, 450);
}

export async function correctRegistrationAttendee(input: {
  registrationId: string;
  actorUserId: string;
  corrections: unknown;
  reason: string;
  expectedRegistrationVersion?: number | null;
}): Promise<RegistrationCorrectionResult> {
  const registrationId = input.registrationId.trim();
  const actorUserId = input.actorUserId.trim();
  if (!registrationId || !actorUserId) {
    throw new RegistrationError("validation", "Registration and operator identity are required.");
  }

  const reason = requireReason(input.reason);
  const corrections = sanitizeRegistrationCorrectionInput(input.corrections);

  const { data, error } = await getSupabaseAdmin().rpc("correct_registration_attendee", {
    p_actor_user_id: actorUserId,
    p_registration_id: registrationId,
    p_corrections: corrections,
    p_expected_registration_version:
      typeof input.expectedRegistrationVersion === "number"
        ? input.expectedRegistrationVersion
        : null,
    p_audit_reason: reason,
  });

  if (error) {
    throw mapDatabaseError(error);
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true || !payload.registration_id) {
    throw new RegistrationError("unavailable", "Attendee correction did not complete.");
  }

  return {
    registrationId: String(payload.registration_id),
    rowVersion: Number(payload.row_version ?? 0),
    firstName: payload.first_name ? String(payload.first_name) : null,
    lastName: payload.last_name ? String(payload.last_name) : null,
    email: payload.email ? String(payload.email) : null,
    mobilePhone: payload.mobile_phone ? String(payload.mobile_phone) : null,
    preferredLanguage: payload.preferred_language ? String(payload.preferred_language) : null,
    requiresInterpretation: payload.requires_interpretation === true,
    dateOfBirth: payload.date_of_birth ? String(payload.date_of_birth) : null,
    status: String(payload.status ?? ""),
    amountCents: typeof payload.amount_cents === "number" ? payload.amount_cents : null,
  };
}
