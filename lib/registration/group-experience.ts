export const JUNIOR_REGISTRATION_PRODUCT_KEY = "JUNIOR_REGISTRATION_GUEST_2026";

export const REGISTRATION_WIZARD_MILESTONES = [
  { id: "attendee", label: "Attendee information" },
  { id: "product", label: "Registration type" },
  { id: "group", label: "Group / Junior registrants" },
  { id: "policy", label: "Policy agreement" },
  { id: "housing", label: "Housing" },
  { id: "review", label: "Review" },
  { id: "payment", label: "Payment / Submit" },
] as const;

/** Authoritative wizard step array — progress copy must derive length from this only. */
export const REGISTRATION_WIZARD_STEPS = REGISTRATION_WIZARD_MILESTONES;

export type RegistrationWizardDestination = (typeof REGISTRATION_WIZARD_MILESTONES)[number]["id"];

export type RegistrationProduct = {
  id: string;
  product_key: string;
  name: string;
  description: string | null;
  eligibility_description: string | null;
  price_cents: number;
  currency: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  capacity: number | null;
  badge_type: string | null;
};

export type GroupRegistrant = {
  id: string;
  is_primary_registrant: boolean;
  relationship_to_primary: string | null;
  guardian_registration_id: string | null;
  registration_product_id: string | null;
  salutation: string | null;
  first_name: string | null;
  last_name: string | null;
  suffix: string | null;
  email: string | null;
  mobile_phone: string | null;
  assistant_email: string | null;
  street_address: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string | null;
  gender: string | null;
  requires_interpretation: boolean;
  preferred_language: string | null;
  church_name: string | null;
  pastor_name: string | null;
  jurisdiction: string | null;
  date_of_birth: string | null;
  amount_cents: number | null;
  currency: string | null;
  status: string;
  confirmation_reference: string | null;
  draft_last_step?: import("@/lib/registration/types").RegistrationStepId | null;
  row_version?: number;
};

export type RegistrationGroup = {
  id: string;
  status: string;
  row_version?: number;
  wizard_resume_step?: number;
  wizard_metadata?: Record<string, unknown>;
  registrations: GroupRegistrant[];
};

export type RegistrationPolicy = {
  id: string;
  version: string;
  title: string;
  content: string;
  content_hash: string;
  effective_at: string;
};

export type RegistrationExperience = {
  products: RegistrationProduct[];
  group: RegistrationGroup | null;
  policy: RegistrationPolicy | null;
  requirements: import("@/lib/registration/registration-requirements").RegistrationRequirementsResult;
  paymentStatus: string | null;
};

export function getPrimaryRegistrant(group: RegistrationGroup | null): GroupRegistrant | null {
  return group?.registrations.find((registrant) => registrant.is_primary_registrant) ?? null;
}

export function getRegistrationProduct(
  products: RegistrationProduct[],
  productId: string | null | undefined,
): RegistrationProduct | null {
  if (!productId) return null;
  return products.find((product) => product.id === productId) ?? null;
}

export function isJuniorRegistrationProduct(productKey: string | null | undefined): boolean {
  return productKey === JUNIOR_REGISTRATION_PRODUCT_KEY;
}

export function getGroupTotalCents(group: RegistrationGroup | null): number {
  if (!group) return 0;

  const primary = getPrimaryRegistrant(group);
  if (group.status !== "draft") {
    return Math.max(0, Number(primary?.amount_cents ?? 0));
  }

  return group.registrations.reduce(
    (total, registrant) => total + Math.max(0, Number(registrant.amount_cents ?? 0)),
    0,
  );
}

export function formatRegistrationAmount(amountCents: number, currency = "usd"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `$${(amountCents / 100).toFixed(2)}`;
  }
}
