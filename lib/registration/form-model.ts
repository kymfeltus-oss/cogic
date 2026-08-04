import { isValidEmail, isValidPhone } from "@/lib/auth/validation";
import { isValidUsStateCode } from "@/lib/auth/us-states";
import type { Registration } from "@/lib/registration/types";
import type { RegistrationValidationIssue } from "@/lib/registration/validation";

export type RegistrationFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  mobilePhone: string;
  churchName: string;
  pastorName: string;
  jurisdiction: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
};

export const EMPTY_REGISTRATION_FORM: RegistrationFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  mobilePhone: "",
  churchName: "",
  pastorName: "",
  jurisdiction: "",
  streetAddress: "",
  city: "",
  state: "",
  postalCode: "",
};

export function registrationToFormValues(
  registration: Registration | null,
): RegistrationFormValues {
  if (!registration) return { ...EMPTY_REGISTRATION_FORM };

  return {
    firstName: registration.firstName ?? "",
    lastName: registration.lastName ?? "",
    email: registration.email ?? "",
    mobilePhone: registration.mobilePhone ?? "",
    churchName: registration.churchName ?? "",
    pastorName: registration.pastorName ?? "",
    jurisdiction: registration.jurisdiction ?? "",
    streetAddress: registration.streetAddress ?? "",
    city: registration.city ?? "",
    state: registration.state ?? "",
    postalCode: registration.postalCode ?? "",
  };
}

export function validateStep(
  step: 1 | 2 | 3,
  values: RegistrationFormValues,
): RegistrationValidationIssue[] {
  const issues: RegistrationValidationIssue[] = [];

  if (step === 1) {
    if (!values.firstName.trim()) {
      issues.push({ field: "firstName", message: "Enter your first name." });
    }
    if (!values.lastName.trim()) {
      issues.push({ field: "lastName", message: "Enter your last name." });
    }
    if (!values.email.trim() || !isValidEmail(values.email)) {
      issues.push({ field: "email", message: "Enter a valid email address." });
    }
    if (!values.mobilePhone.trim() || !isValidPhone(values.mobilePhone)) {
      issues.push({
        field: "mobilePhone",
        message: "Enter a valid 10-digit mobile phone number.",
      });
    }
  }

  if (step === 2) {
    if (!values.churchName.trim()) {
      issues.push({ field: "churchName", message: "Enter your church name." });
    }
    if (!values.pastorName.trim()) {
      issues.push({ field: "pastorName", message: "Enter your pastor’s name." });
    }
    if (!values.jurisdiction.trim()) {
      issues.push({ field: "jurisdiction", message: "Enter your jurisdiction." });
    }
  }

  if (step === 3) {
    if (!values.streetAddress.trim()) {
      issues.push({ field: "streetAddress", message: "Enter your street address." });
    }
    if (!values.city.trim()) {
      issues.push({ field: "city", message: "Enter your city." });
    }
    if (!values.state.trim() || !isValidUsStateCode(values.state)) {
      issues.push({ field: "state", message: "Select a valid U.S. state." });
    }
    if (!values.postalCode.trim()) {
      issues.push({ field: "postalCode", message: "Enter your ZIP or postal code." });
    }
  }

  return issues;
}

export function stepFields(step: 1 | 2 | 3): (keyof RegistrationFormValues)[] {
  if (step === 1) return ["firstName", "lastName", "email", "mobilePhone"];
  if (step === 2) return ["churchName", "pastorName", "jurisdiction"];
  return ["streetAddress", "city", "state", "postalCode"];
}

export const REGISTRATION_FIELD_LABELS: Record<keyof RegistrationFormValues, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  mobilePhone: "Mobile phone",
  churchName: "Church name",
  pastorName: "Pastor name",
  jurisdiction: "Jurisdiction",
  streetAddress: "Street address",
  city: "City",
  state: "State",
  postalCode: "ZIP / Postal code",
};

export const STEP_TITLES = {
  1: "About you",
  2: "Your church",
  3: "Address",
  4: "Review",
} as const;
