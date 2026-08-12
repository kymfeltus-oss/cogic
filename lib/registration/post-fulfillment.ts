import "server-only";

import { CredentialError } from "@/lib/credentials/errors";
import { issueRegistrationCredential } from "@/lib/credentials/repository";
import { enqueueRegistrationCredentialJob } from "@/lib/registration/credential-jobs";

export type RegistrationCredentialIssuanceResult = {
  issued: boolean;
  idempotent: boolean;
  credentialId?: string;
  errorCode?: string;
  errorMessage?: string;
  retryQueued?: boolean;
  retryJobId?: string;
};

/**
 * Best-effort credential issuance after payment confirmation.
 * Payment confirmation is never rolled back when this fails.
 * Soft failure `{ issued: false }` (non-conflict) always enqueues a durable job.
 */
export async function attemptRegistrationCredentialIssuance(input: {
  registrationId: string;
  actorUserId?: string | null;
}): Promise<RegistrationCredentialIssuanceResult> {
  try {
    const result = await issueRegistrationCredential({
      registrationId: input.registrationId,
      actorUserId: input.actorUserId ?? null,
      activate: true,
    });

    return {
      issued: true,
      idempotent: false,
      credentialId: result.credentialId,
      retryQueued: false,
    };
  } catch (error) {
    if (error instanceof CredentialError && error.code === "conflict") {
      return {
        issued: false,
        idempotent: true,
        retryQueued: false,
      };
    }

    const message =
      error instanceof Error ? error.message : "Credential issuance failed.";
    const errorCode = error instanceof CredentialError ? error.code : "unknown";

    try {
      const job = await enqueueRegistrationCredentialJob({
        registrationId: input.registrationId,
        actorUserId: input.actorUserId ?? null,
        errorCode,
        errorMessage: message,
      });
      return {
        issued: false,
        idempotent: false,
        errorCode,
        errorMessage: message,
        retryQueued: true,
        retryJobId: job.jobId,
      };
    } catch (queueError) {
      const queueMessage =
        queueError instanceof Error ? queueError.message : "Credential retry queue failed.";
      console.error("[REGISTRATION_CREDENTIAL_RETRY_QUEUE_FAILED]", {
        registrationId: input.registrationId,
        issuanceError: message,
        queueError: queueMessage,
      });
      return {
        issued: false,
        idempotent: false,
        errorCode,
        errorMessage: `${message} Retry queue unavailable: ${queueMessage}`,
        retryQueued: false,
      };
    }
  }
}

