import "server-only";

import { mapDatabaseError, RegistrationError } from "@/lib/registration/errors";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type RegistrationCredentialJobStatus =
  | "pending"
  | "processing"
  | "retry"
  | "completed"
  | "failed"
  | "canceled"
  | "dead";

export type RegistrationCredentialJob = {
  jobId: string;
  registrationId: string;
  groupId: string | null;
  status: RegistrationCredentialJobStatus;
  attemptCount: number;
  nextAttemptAt: string;
};

export type RegistrationCredentialJobRow = {
  id: string;
  registration_id: string;
  group_id: string | null;
  status: RegistrationCredentialJobStatus;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error_code: string | null;
  last_error: string | null;
  terminal_reason: string | null;
  actor_user_id: string | null;
  last_attempt_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function cleanErrorValue(value: string | null | undefined, fallback: string, max: number) {
  const normalized = value?.trim() || fallback;
  return normalized.replace(/[\r\n\t]+/g, " ").slice(0, max);
}

/** Queue a real confirmed registration after credential issuance fails. */
export async function enqueueRegistrationCredentialJob(input: {
  registrationId: string;
  actorUserId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<RegistrationCredentialJob> {
  const registrationId = input.registrationId.trim();
  if (!registrationId) {
    throw new RegistrationError("validation", "Registration is required for credential retry.");
  }

  const { data, error } = await getSupabaseAdmin().rpc("enqueue_registration_credential_job", {
    p_registration_id: registrationId,
    p_actor_user_id: input.actorUserId?.trim() || null,
    p_error_code: cleanErrorValue(input.errorCode, "unknown", 80),
    p_error_message: cleanErrorValue(
      input.errorMessage,
      "Credential issuance failed and requires retry.",
      400,
    ),
  });
  if (error) throw mapDatabaseError(error);

  const payload = data as Record<string, unknown> | null;
  if (!payload?.job_id || !payload.registration_id || !payload.status || !payload.next_attempt_at) {
    throw new RegistrationError("unavailable", "Credential retry could not be queued.");
  }

  return {
    jobId: String(payload.job_id),
    registrationId: String(payload.registration_id),
    groupId: payload.group_id ? String(payload.group_id) : null,
    status: String(payload.status) as RegistrationCredentialJobStatus,
    attemptCount: Number(payload.attempt_count ?? 0),
    nextAttemptAt: String(payload.next_attempt_at),
  };
}

export async function enqueueRegistrationCredentialJobs(input: {
  registrationIds: string[];
  actorUserId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<RegistrationCredentialJob[]> {
  const jobs: RegistrationCredentialJob[] = [];
  for (const registrationId of input.registrationIds) {
    jobs.push(
      await enqueueRegistrationCredentialJob({
        registrationId,
        actorUserId: input.actorUserId,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      }),
    );
  }
  return jobs;
}

export async function claimRegistrationCredentialJobs(
  limit = 25,
): Promise<RegistrationCredentialJobRow[]> {
  const { data, error } = await getSupabaseAdmin().rpc("claim_registration_credential_jobs", {
    p_limit: Math.max(1, Math.min(limit, 100)),
  });
  if (error) throw mapDatabaseError(error);
  return (data ?? []) as RegistrationCredentialJobRow[];
}

export async function completeRegistrationCredentialJob(input: {
  jobId: string;
  outcome: "completed" | "retry" | "failed" | "dead";
  errorCode?: string | null;
  errorMessage?: string | null;
  retryDelaySeconds?: number;
}): Promise<{
  jobId: string;
  registrationId: string;
  groupId: string | null;
  status: RegistrationCredentialJobStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  terminalReason: string | null;
}> {
  const jobId = input.jobId.trim();
  if (!jobId) {
    throw new RegistrationError("validation", "Credential job id is required.");
  }

  const { data, error } = await getSupabaseAdmin().rpc("complete_registration_credential_job", {
    p_job_id: jobId,
    p_outcome: input.outcome,
    p_error_code: input.errorCode?.trim() || null,
    p_error_message: input.errorMessage?.trim() || null,
    p_retry_delay_seconds: input.retryDelaySeconds ?? 60,
  });
  if (error) throw mapDatabaseError(error);

  const payload = data as Record<string, unknown> | null;
  if (!payload?.job_id || !payload.status || !payload.registration_id) {
    throw new RegistrationError("unavailable", "Unable to complete credential issuance job.");
  }

  return {
    jobId: String(payload.job_id),
    registrationId: String(payload.registration_id),
    groupId: payload.group_id ? String(payload.group_id) : null,
    status: String(payload.status) as RegistrationCredentialJobStatus,
    attemptCount: Number(payload.attempt_count ?? 0),
    nextAttemptAt: payload.next_attempt_at ? String(payload.next_attempt_at) : null,
    terminalReason: payload.terminal_reason ? String(payload.terminal_reason) : null,
  };
}
