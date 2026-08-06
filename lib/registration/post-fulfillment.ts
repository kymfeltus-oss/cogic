import "server-only";

import { CredentialError } from "@/lib/credentials/errors";
import { issueRegistrationCredential } from "@/lib/credentials/repository";

export type RegistrationCredentialIssuanceResult = {
  issued: boolean;
  idempotent: boolean;
  credentialId?: string;
  errorCode?: string;
  errorMessage?: string;
};

/**
 * Best-effort credential issuance after payment confirmation.
 * Payment confirmation is never rolled back when this fails.
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
    };
  } catch (error) {
    if (error instanceof CredentialError && error.code === "conflict") {
      return {
        issued: false,
        idempotent: true,
      };
    }

    const message =
      error instanceof Error ? error.message : "Credential issuance failed.";

    console.warn("[REGISTRATION_CREDENTIAL_ISSUANCE_FAILED]", {
      registrationId: input.registrationId,
      message,
    });

    return {
      issued: false,
      idempotent: false,
      errorCode: error instanceof CredentialError ? error.code : "unknown",
      errorMessage: message,
    };
  }
}

