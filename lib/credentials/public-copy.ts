/** Public attendee copy — no secrets, no identity claims. */

export const CREDENTIAL_UNAVAILABLE_MESSAGE =
  "This credential is unavailable. Please visit registration support.";

export const CREDENTIAL_SUPPORT_INSTRUCTIONS =
  "If you need help, visit the Convocation registration desk or contact the registration support team. QR possession confirms credential access only — not personal identity.";

export const CREDENTIAL_CONFIRMED_HEADING = "Convocation credential";

export const CREDENTIAL_CONFIRMED_LEAD =
  "Your registration credential is active. Show this screen at badge pickup or entry checkpoints when requested.";

export const PROGRAM_DISPLAY_LABELS: Record<string, string> = {
  "cogic-stream-2026": "COGIC Stream Holy Convocation 2026",
};

export function programDisplayLabel(programKey: string | null | undefined): string | null {
  if (!programKey) return null;
  return PROGRAM_DISPLAY_LABELS[programKey] ?? "Holy Convocation";
}
