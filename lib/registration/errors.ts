export type RegistrationErrorCode =
  | "auth_required"
  | "guest_not_allowed"
  | "not_editable"
  | "not_found"
  | "validation"
  | "duplicate"
  | "conflict"
  | "unavailable"
  | "forbidden"
  | "unknown";

export class RegistrationError extends Error {
  readonly code: RegistrationErrorCode;
  readonly fieldIssues?: { field: string; message: string }[];

  constructor(
    code: RegistrationErrorCode,
    message: string,
    fieldIssues?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = "RegistrationError";
    this.code = code;
    this.fieldIssues = fieldIssues;
  }
}

export function toSafeRegistrationMessage(error: unknown): string {
  if (error instanceof RegistrationError) {
    return error.message;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("supabase server credentials")) {
      return "Registration is temporarily unavailable. Please try again later.";
    }
    if (message.includes("duplicate") || message.includes("unique")) {
      return "An active registration already exists for this account or email.";
    }
    if (message.includes("cannot update draft")) {
      return "This registration can no longer be edited.";
    }
  }

  return "Something went wrong while saving your registration. Please try again.";
}

export function registrationHttpStatus(error: unknown): number {
  if (!(error instanceof RegistrationError)) return 500;
  switch (error.code) {
    case "auth_required": return 401;
    case "forbidden":
    case "guest_not_allowed": return 403;
    case "not_found": return 404;
    case "duplicate":
    case "conflict":
    case "not_editable": return 409;
    case "validation": return 422;
    case "unavailable":
    case "unknown": return 503;
  }
}

export function mapDatabaseError(error: {
  code?: string | null;
  message?: string | null;
}): RegistrationError {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (
    code === "40001" ||
    message.includes("version changed") ||
    message.includes("member set changed") ||
    message.includes("version conflict") ||
    message.includes("serialization failure")
  ) {
    return new RegistrationError(
      "conflict",
      "Registration changed while you were working. Review the latest saved information and try again.",
    );
  }

  if (code === "23505" || message.includes("unique") || message.includes("duplicate")) {
    return new RegistrationError(
      "duplicate",
      "An active registration already exists for this account or email.",
    );
  }

  if (
    message.includes("requires complete") ||
    message.includes("check_violation") ||
    message.includes("primary draft requires complete") ||
    message.includes("rejects client-supplied")
  ) {
    return new RegistrationError(
      "validation",
      "Please complete all required fields before continuing.",
    );
  }

  if (message.includes("invalid registration status")) {
    return new RegistrationError(
      "not_editable",
      "This registration can no longer be changed.",
    );
  }

  return new RegistrationError(
    "unavailable",
    "Registration is temporarily unavailable. Please try again later.",
  );
}
