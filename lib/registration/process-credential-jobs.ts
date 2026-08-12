import "server-only";

import { CredentialError } from "@/lib/credentials/errors";
import { issueRegistrationCredential } from "@/lib/credentials/repository";
import {
  claimRegistrationCredentialJobs,
  completeRegistrationCredentialJob,
  type RegistrationCredentialJobRow,
} from "@/lib/registration/credential-jobs";

export type ProcessedRegistrationCredentialJob = {
  jobId: string;
  registrationId: string;
  outcome: "completed" | "retry" | "dead" | "failed";
  attemptCount: number;
  errorCode?: string;
  errorMessage?: string;
};

export type ProcessRegistrationCredentialJobsResult = {
  claimed: number;
  processed: number;
  completed: number;
  retried: number;
  dead: number;
  failed: number;
  jobs: ProcessedRegistrationCredentialJob[];
};

function resolveRetryOutcome(
  job: RegistrationCredentialJobRow,
): "retry" | "dead" {
  const nextAttempt = Number(job.attempt_count ?? 0) + 1;
  const maxAttempts = Number(job.max_attempts ?? 5);
  if (nextAttempt >= maxAttempts) {
    return "dead";
  }
  return "retry";
}

async function processOneCredentialJob(
  job: RegistrationCredentialJobRow,
): Promise<ProcessedRegistrationCredentialJob> {
  try {
    await issueRegistrationCredential({
      registrationId: job.registration_id,
      actorUserId: job.actor_user_id,
      activate: true,
    });

    const completed = await completeRegistrationCredentialJob({
      jobId: job.id,
      outcome: "completed",
    });

    return {
      jobId: completed.jobId,
      registrationId: completed.registrationId,
      outcome: "completed",
      attemptCount: completed.attemptCount,
    };
  } catch (error) {
    if (error instanceof CredentialError && error.code === "conflict") {
      const completed = await completeRegistrationCredentialJob({
        jobId: job.id,
        outcome: "completed",
        errorCode: "conflict",
        errorMessage: "Credential already issued; queue job closed idempotently.",
      });
      return {
        jobId: completed.jobId,
        registrationId: completed.registrationId,
        outcome: "completed",
        attemptCount: completed.attemptCount,
        errorCode: "conflict",
        errorMessage: "Credential already issued; queue job closed idempotently.",
      };
    }

    const errorCode = error instanceof CredentialError ? error.code : "unknown";
    const errorMessage =
      error instanceof Error ? error.message : "Credential issuance failed.";
    const outcome = resolveRetryOutcome(job);

    const finished = await completeRegistrationCredentialJob({
      jobId: job.id,
      outcome,
      errorCode,
      errorMessage,
      retryDelaySeconds: outcome === "retry" ? 60 : undefined,
    });

    return {
      jobId: finished.jobId,
      registrationId: finished.registrationId,
      outcome,
      attemptCount: finished.attemptCount,
      errorCode,
      errorMessage,
    };
  }
}

/**
 * Claim due credential retry jobs and attempt real issuance.
 * Never invents credentials; never marks payment paid.
 */
export async function processDueRegistrationCredentialJobs(
  limit = 25,
): Promise<ProcessRegistrationCredentialJobsResult> {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
  const claimed = await claimRegistrationCredentialJobs(safeLimit);
  const jobs: ProcessedRegistrationCredentialJob[] = [];

  let completed = 0;
  let retried = 0;
  let dead = 0;
  let failed = 0;

  for (const job of claimed) {
    const result = await processOneCredentialJob(job);
    jobs.push(result);
    if (result.outcome === "completed") {
      completed += 1;
    } else if (result.outcome === "retry") {
      retried += 1;
    } else if (result.outcome === "dead") {
      dead += 1;
    } else {
      failed += 1;
    }
  }

  return {
    claimed: claimed.length,
    processed: jobs.length,
    completed,
    retried,
    dead,
    failed,
    jobs,
  };
}
