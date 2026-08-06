/**
 * Centralized secret/token redaction for logs and diagnostics.
 * Never reverse these replacements — treat output as display-only.
 */

const REDACTED = "[REDACTED]";

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bAuthorization\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9._~+/=-]+["']?/gi,
  /\bsk_(?:live|test)_[A-Za-z0-9]+/gi,
  /\bwhsec_[A-Za-z0-9]+/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /\b(?:sb_secret_|service_role)[A-Za-z0-9._=-]*/gi,
  /https?:\/\/[^\s"'`]+\/c\/[A-Za-z0-9_-]{20,}/gi,
  /\/c\/[A-Za-z0-9_-]{43}/g,
  /\bcogic_credential_session\s*[:=]\s*[^\s;,"']+/gi,
  /\bCOGIC_CREDENTIAL_SESSION_SECRET\s*[:=]\s*[^\s,"']+/gi,
  /\bSUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*[^\s,"']+/gi,
  /\bSTRIPE_SECRET_KEY\s*[:=]\s*[^\s,"']+/gi,
  /\bSTRIPE_WEBHOOK_SECRET\s*[:=]\s*[^\s,"']+/gi,
  /\bTOKEN_ENCRYPTION_KEY\s*[:=]\s*[^\s,"']+/gi,
];

const SENSITIVE_OBJECT_KEYS = new Set([
  "authorization",
  "Authorization",
  "cookie",
  "Cookie",
  "stripe-signature",
  "rawToken",
  "token",
  "credentialToken",
  "sessionSecret",
  "serviceRoleKey",
  "stripeSecretKey",
  "webhookSecret",
  "password",
  "secret",
]);

export function redactSecrets(input: string): string {
  let output = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    output = output.replace(pattern, REDACTED);
  }
  return output;
}

export function redactForLog(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactSecrets(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSecrets(value.message),
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item));
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_OBJECT_KEYS.has(key) || /secret|token|password|authorization/i.test(key)) {
        result[key] = REDACTED;
      } else {
        result[key] = redactForLog(nested);
      }
    }
    return result;
  }
  return String(value);
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return redactSecrets(error.message);
  if (typeof error === "string") return redactSecrets(error);
  if (typeof error === "object" && error !== null && "message" in error) {
    return redactSecrets(String((error as { message: unknown }).message));
  }
  return "Unknown error";
}
