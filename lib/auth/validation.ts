/** Standard email structure check for onboarding UI markers */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** US-style 10-digit phone after stripping non-digits */
export const PHONE_DIGIT_COUNT = 10;

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, PHONE_DIGIT_COUNT);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return normalizePhoneDigits(value).length === PHONE_DIGIT_COUNT;
}

export function formatPhoneDisplay(digits: string): string {
  const normalized = normalizePhoneDigits(digits);
  if (normalized.length !== PHONE_DIGIT_COUNT) return digits;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

export type FieldValidationState = "idle" | "valid" | "invalid";

export function emailValidationState(value: string, touched: boolean): FieldValidationState {
  if (!touched || !value.trim()) return "idle";
  return isValidEmail(value) ? "valid" : "invalid";
}

export function phoneValidationState(value: string, touched: boolean): FieldValidationState {
  if (!touched || !value.trim()) return "idle";
  return isValidPhone(value) ? "valid" : "invalid";
}
