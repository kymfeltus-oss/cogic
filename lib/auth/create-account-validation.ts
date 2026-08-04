import { isAllowedAvatarMimeType } from "@/lib/profile/avatar-storage";
import { isValidUsStateCode } from "@/lib/auth/us-states";
import {
  formatPhoneDisplay,
  isValidEmail,
  isValidPhone,
  normalizePhoneDigits,
} from "@/lib/auth/validation";

export const CREATE_ACCOUNT_MIN_PASSWORD_LENGTH = 8;
export const CREATE_ACCOUNT_AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export type CreateAccountFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  avatarFile: File | null;
};

export type CreateAccountFieldErrors = Partial<
  Record<
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "city"
    | "state"
    | "password"
    | "confirmPassword"
    | "acceptedTerms"
    | "avatarFile"
    | "form",
    string
  >
>;

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateCreateAccountForm(
  values: CreateAccountFormValues,
): CreateAccountFieldErrors {
  const errors: CreateAccountFieldErrors = {};

  if (!normalizeName(values.firstName)) {
    errors.firstName = "First name is required.";
  }

  if (!normalizeName(values.lastName)) {
    errors.lastName = "Last name is required.";
  }

  if (!values.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!isValidEmail(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (values.phone.trim() && !isValidPhone(values.phone)) {
    errors.phone = "Enter a valid 10-digit US phone number.";
  }

  if (!values.city.trim()) {
    errors.city = "City is required.";
  }

  if (!values.state.trim()) {
    errors.state = "State is required.";
  } else if (!isValidUsStateCode(values.state)) {
    errors.state = "Select a valid US state.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < CREATE_ACCOUNT_MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${CREATE_ACCOUNT_MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  if (!values.acceptedTerms) {
    errors.acceptedTerms = "You must accept the terms to create an account.";
  }

  if (values.avatarFile) {
    if (!isAllowedAvatarMimeType(values.avatarFile.type)) {
      errors.avatarFile = "Use a JPG, PNG, or WebP image.";
    } else if (values.avatarFile.size > CREATE_ACCOUNT_AVATAR_MAX_BYTES) {
      errors.avatarFile = "Profile photo must be 5 MB or smaller.";
    }
  }

  return errors;
}

export function isCreateAccountFormValid(values: CreateAccountFormValues): boolean {
  return Object.keys(validateCreateAccountForm(values)).length === 0;
}

export function formatFullName(values: Pick<CreateAccountFormValues, "firstName" | "lastName">): string {
  return [normalizeName(values.firstName), normalizeName(values.lastName)].filter(Boolean).join(" ");
}

export function applyFullNameInput(
  fullName: string,
): Pick<CreateAccountFormValues, "firstName" | "lastName"> {
  const normalized = normalizeName(fullName);
  if (!normalized) return { firstName: "", lastName: "" };
  const parts = normalized.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function formatCreateAccountPhoneInput(value: string): string {
  const digits = normalizePhoneDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return formatPhoneDisplay(digits);
}

export function serializeCreateAccountPayload(values: CreateAccountFormValues) {
  return {
    action: "signup" as const,
    firstName: normalizeName(values.firstName),
    lastName: normalizeName(values.lastName),
    email: values.email.trim().toLowerCase(),
    phone: normalizePhoneDigits(values.phone),
    city: values.city.trim(),
    state: values.state.trim().toUpperCase(),
    password: values.password,
    confirmPassword: values.confirmPassword,
  };
}
