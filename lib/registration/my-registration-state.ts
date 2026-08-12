import type { RegistrationStatus } from "@/lib/registration/types";

export type MyRegistrationJourneyStepId =
  | "draft"
  | "submitted"
  | "payment_pending"
  | "confirmed"
  | "credential_issued";

export type MyRegistrationNextAction = {
  id: string;
  label: string;
  href: string;
  priority: number;
  reason: string;
};

export type MyRegistrationBlocker = {
  id: string;
  label: string;
};

export type MyRegistrationStateInput = {
  status: RegistrationStatus | "none";
  hasProduct: boolean;
  missingProfileFields: string[];
  groupMemberCount: number;
  juniorMissingDob: boolean;
  policyAccepted: boolean;
  totalAmountCents: number;
  amountPaidCents: number;
  remainingBalanceCents: number;
  paymentStatus: string | null;
  credentialReady: boolean;
  credentialMissingWhileConfirmed: boolean;
  housingPreference: string | null;
  housingStatus: string | null;
  hasTravelActivity: boolean;
};

export type RegistrationProgressInput = Pick<
  MyRegistrationStateInput,
  | "status"
  | "hasProduct"
  | "missingProfileFields"
  | "groupMemberCount"
  | "juniorMissingDob"
  | "policyAccepted"
  | "remainingBalanceCents"
  | "housingPreference"
> & {
  requiredProfileFieldCount: number;
};

/**
 * Completion of the seven persisted registration stages. Profile completion is
 * proportional to its required fields; every other stage is backed by saved
 * registration, policy, housing, submission, or payment state.
 */
export function calculateRegistrationProgress(input: RegistrationProgressInput) {
  if (input.status === "none") return 0;

  const requiredFields = Math.max(input.requiredProfileFieldCount, 1);
  const completedFields = Math.max(0, requiredFields - input.missingProfileFields.length);
  const profileStage = completedFields / requiredFields;
  const groupStage = input.groupMemberCount > 0 && !input.juniorMissingDob ? 1 : 0;
  const submitted = ["submitted", "payment_pending", "confirmed"].includes(input.status);
  const paymentComplete = input.status === "confirmed" && input.remainingBalanceCents === 0;
  const completedStages =
    profileStage +
    Number(input.hasProduct) +
    groupStage +
    Number(input.policyAccepted) +
    Number(Boolean(input.housingPreference)) +
    Number(submitted) +
    Number(paymentComplete);

  return Math.max(0, Math.min(100, Math.round((completedStages / 7) * 100)));
}

const JOURNEY: MyRegistrationJourneyStepId[] = [
  "draft",
  "submitted",
  "payment_pending",
  "confirmed",
  "credential_issued",
];

export function registrationJourneySteps(status: RegistrationStatus | "none", credentialReady: boolean) {
  const labels: Record<MyRegistrationJourneyStepId, string> = {
    draft: "Draft",
    submitted: "Submitted",
    payment_pending: "Payment Pending",
    confirmed: "Confirmed",
    credential_issued: "Credential Issued",
  };

  // Persisted registration status only — Stripe redirect alone never advances steps.
  let currentIndex = -1;
  if (status === "draft") currentIndex = 0;
  else if (status === "submitted") currentIndex = 1;
  else if (status === "payment_pending") currentIndex = 2;
  else if (status === "confirmed") currentIndex = credentialReady ? 4 : 3;

  return JOURNEY.map((id, index) => {
    let state: "complete" | "current" | "upcoming" | "blocked" = "upcoming";
    if (status === "none") {
      state = "upcoming";
    } else if (status === "canceled" || status === "refunded") {
      state = "blocked";
    } else if (index < currentIndex) {
      state = "complete";
    } else if (index === currentIndex) {
      state = "current";
    }
    return { id, label: labels[id], state };
  });
}

export function buildRegistrationBlockers(input: MyRegistrationStateInput): MyRegistrationBlocker[] {
  const blockers: MyRegistrationBlocker[] = [];
  if (input.status === "none") return blockers;
  if (input.status === "canceled" || input.status === "refunded") return blockers;

  if (input.missingProfileFields.length) {
    blockers.push({
      id: "missing_profile",
      label: `Missing required profile fields: ${input.missingProfileFields.join(", ")}`,
    });
  }
  if (!input.hasProduct) {
    blockers.push({ id: "missing_product", label: "Registration product not selected" });
  }
  if (input.juniorMissingDob) {
    blockers.push({ id: "junior_dob", label: "Junior registrant is missing date of birth" });
  }
  if (!input.policyAccepted && (input.status === "draft" || input.status === "submitted")) {
    blockers.push({ id: "policy", label: "Required policy acceptance is incomplete" });
  }
  if (input.status === "submitted" || (input.remainingBalanceCents > 0 && input.status !== "confirmed")) {
    if (input.status !== "payment_pending") {
      blockers.push({ id: "payment_outstanding", label: "Registration payment is outstanding" });
    }
  }
  if (input.status === "payment_pending") {
    blockers.push({
      id: "payment_pending",
      label: "Payment is pending Stripe confirmation",
    });
  }
  if (input.credentialMissingWhileConfirmed) {
    blockers.push({
      id: "credential_awaiting",
      label: "Credential awaiting issuance after confirmation",
    });
  }
  return blockers;
}

export function buildRegistrationNextActions(
  input: MyRegistrationStateInput,
): MyRegistrationNextAction[] {
  const actions: MyRegistrationNextAction[] = [];

  if (input.status === "none") {
    return [
      {
        id: "register",
        label: "Begin Registration",
        href: "/register",
        priority: 1,
        reason: "No registration exists for this program.",
      },
    ];
  }

  if (input.status === "canceled") {
    return [
      {
        id: "reregister",
        label: "Start a new registration",
        href: "/register",
        priority: 1,
        reason: "This registration was canceled.",
      },
      {
        id: "support",
        label: "Contact support",
        href: "/contact-us",
        priority: 2,
        reason: "Need help with a canceled registration.",
      },
    ];
  }

  if (input.status === "refunded") {
    return [
      {
        id: "reregister",
        label: "Start a new registration",
        href: "/register",
        priority: 1,
        reason: "This registration was refunded.",
      },
      {
        id: "support",
        label: "Contact support",
        href: "/contact-us",
        priority: 2,
        reason: "Need help with a refunded registration.",
      },
    ];
  }

  if (input.status === "draft") {
    actions.push({
      id: "complete_registration",
      label: "Complete registration",
      href: "/register",
      priority: 1,
      reason: "Your registration draft is incomplete.",
    });
    if (input.missingProfileFields.length) {
      actions.push({
        id: "complete_profile",
        label: "Complete required profile fields",
        href: "/register",
        priority: 2,
        reason: "Required profile fields are missing.",
      });
    }
    if (!input.hasProduct) {
      actions.push({
        id: "select_product",
        label: "Select registration product",
        href: "/register",
        priority: 3,
        reason: "A registration product is required.",
      });
    }
    actions.push({
      id: "review_group",
      label: "Add/review group members",
      href: "/register",
      priority: 4,
      reason: "Review everyone included in this registration group.",
    });
    if (input.juniorMissingDob) {
      actions.push({
        id: "junior_dob",
        label: "Add required DOB for junior",
        href: "/register",
        priority: 5,
        reason: "Child registrants require a date of birth.",
      });
    }
    if (!input.policyAccepted) {
      actions.push({
        id: "accept_policy",
        label: "Review/accept required policy",
        href: "/register",
        priority: 6,
        reason: "Policy acceptance is required before submit.",
      });
    }
  }

  if (input.status === "submitted") {
    actions.push({
      id: "complete_payment",
      label: "Complete registration payment",
      href: "/register/review",
      priority: 1,
      reason: "Payment is required to confirm registration.",
    });
  }

  if (input.status === "payment_pending") {
    actions.push({
      id: "wait_stripe",
      label: "Wait for Stripe confirmation",
      href: "/register/payment/complete",
      priority: 1,
      reason: "Checkout was started. Confirmation comes from the Stripe webhook, not the browser redirect.",
    });
    actions.push({
      id: "resume_payment",
      label: "Complete registration payment",
      href: "/register/review",
      priority: 2,
      reason: "You can resume checkout if payment did not finish.",
    });
  }

  if (input.status === "confirmed") {
    if (input.amountPaidCents > 0) {
      actions.push({
        id: "view_receipt",
        label: "View receipt",
        href: "#payments",
        priority: 3,
        reason: "Paid registration records are available below.",
      });
    }
    if (input.credentialReady) {
      actions.push({
        id: "view_credential",
        label: "View credential",
        href: "#credentials",
        priority: 1,
        reason: "Your secure credential is ready.",
      });
    } else {
      actions.push({
        id: "credential_pending",
        label: "Credential pending",
        href: "#credentials",
        priority: 1,
        reason: "Registration is confirmed, but credential issuance is not complete yet.",
      });
    }
  }

  if (
    input.status === "confirmed" ||
    input.status === "submitted" ||
    input.status === "payment_pending" ||
    input.status === "draft"
  ) {
    actions.push({
      id: "housing",
      label: input.housingPreference ? "Review housing" : "Complete/review housing",
      href: "/housing",
      priority: input.status === "confirmed" ? 4 : 8,
      reason: "Housing is managed separately from registration payment totals.",
    });
  }

  if (input.hasTravelActivity || input.status === "confirmed") {
    actions.push({
      id: "my_trip",
      label: "View My Trip",
      href: "/travel/trip",
      priority: 9,
      reason: "Open travel itinerary without leaving registration context.",
    });
  }

  actions.push({
    id: "support",
    label: "Contact support",
    href: "/contact-us",
    priority: 20,
    reason: "Get help with registration.",
  });

  return actions.sort((a, b) => a.priority - b.priority);
}

export function maskBadgeCode(badgeCode: string | null | undefined) {
  if (!badgeCode) return null;
  if (badgeCode.length <= 4) return `••••${badgeCode}`;
  return `••••${badgeCode.slice(-4)}`;
}

export function moneyLabel(cents: number | null | undefined, currency = "usd") {
  if (cents == null) return "—";
  try {
    return (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}
