import {
  isValidEmail,
  isValidPhone,
  normalizePhoneDigits,
} from "@/lib/auth/validation";
import { isValidUsStateCode } from "@/lib/auth/us-states";
import type {
  RegistrationDraftInput,
  RegistrationSubmissionInput,
} from "@/lib/registration/types";

export type RegistrationValidationIssue = {
  field: string;
  message: string;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeRegistrationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeRegistrationPhone(phone: string): string {
  return normalizePhoneDigits(phone);
}

/**
 * Normalize only keys present on the input so partial step saves do not
 * wipe unrelated draft fields.
 */
export function normalizeDraftInput(
  input: RegistrationDraftInput,
): RegistrationDraftInput {
  const next: RegistrationDraftInput = {};

  if ("programKey" in input) {
    next.programKey = input.programKey?.trim() || undefined;
  }
  if ("firstName" in input) next.firstName = trimOrNull(input.firstName);
  if ("lastName" in input) next.lastName = trimOrNull(input.lastName);
  if ("email" in input) {
    next.email =
      input.email != null ? normalizeRegistrationEmail(input.email) || null : null;
  }
  if ("mobilePhone" in input) {
    next.mobilePhone =
      input.mobilePhone != null
        ? normalizeRegistrationPhone(input.mobilePhone) || null
        : null;
  }
  if ("streetAddress" in input) {
    next.streetAddress = trimOrNull(input.streetAddress);
  }
  if ("city" in input) next.city = trimOrNull(input.city);
  if ("state" in input) {
    next.state =
      input.state != null ? input.state.trim().toUpperCase() || null : null;
  }
  if ("postalCode" in input) next.postalCode = trimOrNull(input.postalCode);
  if ("churchName" in input) next.churchName = trimOrNull(input.churchName);
  if ("pastorName" in input) next.pastorName = trimOrNull(input.pastorName);
  if ("jurisdiction" in input) {
    next.jurisdiction = trimOrNull(input.jurisdiction);
  }
  if ("amountCents" in input) next.amountCents = input.amountCents ?? null;
  if ("currency" in input) {
    next.currency = input.currency?.trim().toLowerCase() || undefined;
  }

  return next;
}

export function validateRegistrationSubmission(
  input: RegistrationSubmissionInput,
): RegistrationValidationIssue[] {
  const issues: RegistrationValidationIssue[] = [];
  const firstName = trimOrNull(input.firstName);
  const lastName = trimOrNull(input.lastName);
  const email = normalizeRegistrationEmail(input.email);
  const mobilePhone = normalizeRegistrationPhone(input.mobilePhone);
  const streetAddress = trimOrNull(input.streetAddress);
  const city = trimOrNull(input.city);
  const state = input.state.trim().toUpperCase();
  const postalCode = trimOrNull(input.postalCode);
  const churchName = trimOrNull(input.churchName);
  const pastorName = trimOrNull(input.pastorName);
  const jurisdiction = trimOrNull(input.jurisdiction);

  if (!firstName) issues.push({ field: "firstName", message: "First name is required." });
  if (!lastName) issues.push({ field: "lastName", message: "Last name is required." });
  if (!email || !isValidEmail(email)) {
    issues.push({ field: "email", message: "Enter a valid email address." });
  }
  if (!mobilePhone || !isValidPhone(mobilePhone)) {
    issues.push({ field: "mobilePhone", message: "Enter a valid 10-digit mobile phone." });
  }
  if (!streetAddress) {
    issues.push({ field: "streetAddress", message: "Street address is required." });
  }
  if (!city) issues.push({ field: "city", message: "City is required." });
  if (!state || !isValidUsStateCode(state)) {
    issues.push({ field: "state", message: "Select a valid U.S. state." });
  }
  if (!postalCode) {
    issues.push({ field: "postalCode", message: "Postal code is required." });
  }
  if (!churchName) {
    issues.push({ field: "churchName", message: "Church name is required." });
  }
  if (!pastorName) {
    issues.push({ field: "pastorName", message: "Pastor name is required." });
  }
  if (!jurisdiction) {
    issues.push({ field: "jurisdiction", message: "Jurisdiction is required." });
  }
  if (input.amountCents != null && input.amountCents < 0) {
    issues.push({ field: "amountCents", message: "Amount cannot be negative." });
  }

  return issues;
}

export function assertRegistrationSubmission(
  input: RegistrationSubmissionInput,
): RegistrationSubmissionInput {
  const issues = validateRegistrationSubmission(input);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }

  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: normalizeRegistrationEmail(input.email),
    mobilePhone: normalizeRegistrationPhone(input.mobilePhone),
    streetAddress: input.streetAddress.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    postalCode: input.postalCode.trim(),
    churchName: input.churchName.trim(),
    pastorName: input.pastorName.trim(),
    jurisdiction: input.jurisdiction.trim(),
    amountCents: input.amountCents ?? null,
    currency: input.currency?.trim().toLowerCase() || "usd",
  };
}
