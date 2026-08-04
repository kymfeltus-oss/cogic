export type CredentialErrorCode =
  | "not_found"
  | "not_eligible"
  | "conflict"
  | "validation"
  | "forbidden"
  | "unavailable"
  | "unknown";

export class CredentialError extends Error {
  readonly code: CredentialErrorCode;

  constructor(code: CredentialErrorCode, message: string) {
    super(message);
    this.name = "CredentialError";
    this.code = code;
  }
}

export function mapCredentialDatabaseError(error: {
  code?: string | null;
  message?: string | null;
}): CredentialError {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (
    message.includes("confirmed") ||
    message.includes("only be issued") ||
    message.includes("only be rotated")
  ) {
    return new CredentialError(
      "not_eligible",
      "Credentials can only be issued for confirmed registrations.",
    );
  }

  if (
    code === "23505" ||
    message.includes("unique") ||
    message.includes("already exists")
  ) {
    return new CredentialError(
      "conflict",
      "A usable credential already exists for this registration.",
    );
  }

  if (code === "PGRST116" || message.includes("not found")) {
    return new CredentialError("not_found", "Credential was not found.");
  }

  if (message.includes("invalid") || message.includes("token_hash")) {
    return new CredentialError("validation", "Invalid credential request.");
  }

  return new CredentialError(
    "unavailable",
    "Credential service is temporarily unavailable.",
  );
}
