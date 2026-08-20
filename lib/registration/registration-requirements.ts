import {
  buildRegistrationBlockers,
  buildRegistrationNextActions,
  calculateRegistrationProgress,
  registrationJourneySteps,
  type MyRegistrationBlocker,
  type MyRegistrationNextAction,
  type MyRegistrationStateInput,
  type RegistrationProgressInput,
} from "@/lib/registration/my-registration-state";
import type { RegistrationStatus, RegistrationStepId } from "@/lib/registration/types";

/**
 * Registration-only wizard. Travel and housing live in COGIC Travel.
 */
export const REGISTRATION_WIZARD_STEPS = {
  ATTENDEE_INFORMATION: 1,
  REGISTRATION_TYPE: 2,
  GROUP_MEMBERS: 3,
  POLICY_AGREEMENT: 4,
  REVIEW: 5,
  PAYMENT_SUBMIT: 6,
  COMPLETE: 7,
} as const;

export type RegistrationRequirementId =
  | "profile"
  | "product"
  | "group"
  | "policy"
  | "submitted"
  | "payment";

export type RegistrationCompletedRequirement = {
  id: RegistrationRequirementId;
  label: string;
  complete: boolean;
};

export type RegistrationRequirementsInput = MyRegistrationStateInput & {
  requiredProfileFieldCount: number;
};

export type RegistrationStepDestination =
  | "attendee"
  | "product"
  | "group"
  | "policy"
  | "review"
  | "payment"
  | "complete";

export type RegistrationRequirementsResult = {
  completedRequirements: RegistrationCompletedRequirement[];
  blockers: MyRegistrationBlocker[];
  totalCompletionPercent: number;
  resumeStep: number;
  resumeStepId: RegistrationStepId | "complete";
  allowedStepDestinations: Array<{
    step: number;
    destination: RegistrationStepDestination;
  }>;
  journey: ReturnType<typeof registrationJourneySteps>;
  nextActions: MyRegistrationNextAction[];
};

const STEP_DESTINATIONS: Array<{
  step: number;
  destination: RegistrationStepDestination;
}> = [
  { step: REGISTRATION_WIZARD_STEPS.ATTENDEE_INFORMATION, destination: "attendee" },
  { step: REGISTRATION_WIZARD_STEPS.REGISTRATION_TYPE, destination: "product" },
  { step: REGISTRATION_WIZARD_STEPS.GROUP_MEMBERS, destination: "group" },
  { step: REGISTRATION_WIZARD_STEPS.POLICY_AGREEMENT, destination: "policy" },
  { step: REGISTRATION_WIZARD_STEPS.REVIEW, destination: "review" },
  { step: REGISTRATION_WIZARD_STEPS.PAYMENT_SUBMIT, destination: "payment" },
  { step: REGISTRATION_WIZARD_STEPS.COMPLETE, destination: "complete" },
];

/**
 * Explicit requirement-stage → wizard index mapping.
 * Resolves DTO mismatch between Hub progress stages and wizard step numbers.
 */
export const REQUIREMENT_STAGE_TO_WIZARD_STEP: Record<
  RegistrationRequirementId,
  number
> = {
  profile: REGISTRATION_WIZARD_STEPS.ATTENDEE_INFORMATION,
  product: REGISTRATION_WIZARD_STEPS.REGISTRATION_TYPE,
  group: REGISTRATION_WIZARD_STEPS.GROUP_MEMBERS,
  policy: REGISTRATION_WIZARD_STEPS.POLICY_AGREEMENT,
  submitted: REGISTRATION_WIZARD_STEPS.REVIEW,
  payment: REGISTRATION_WIZARD_STEPS.PAYMENT_SUBMIT,
};

const RESUME_STEP_IDS: Record<number, RegistrationStepId | "complete"> = {
  [REGISTRATION_WIZARD_STEPS.ATTENDEE_INFORMATION]: "attendee",
  [REGISTRATION_WIZARD_STEPS.REGISTRATION_TYPE]: "product",
  [REGISTRATION_WIZARD_STEPS.GROUP_MEMBERS]: "group",
  [REGISTRATION_WIZARD_STEPS.POLICY_AGREEMENT]: "policy",
  [REGISTRATION_WIZARD_STEPS.REVIEW]: "review",
  [REGISTRATION_WIZARD_STEPS.PAYMENT_SUBMIT]: "payment",
  [REGISTRATION_WIZARD_STEPS.COMPLETE]: "complete",
};

function profileComplete(input: RegistrationProgressInput): boolean {
  return (input.missingProfileFields ?? []).length === 0;
}

function groupComplete(input: RegistrationProgressInput): boolean {
  return input.groupMemberCount > 0 && !input.juniorMissingDob;
}

function submittedComplete(status: RegistrationStatus | "none"): boolean {
  return ["submitted", "payment_pending", "confirmed"].includes(status);
}

function paymentComplete(input: RegistrationProgressInput): boolean {
  return input.status === "confirmed" && input.remainingBalanceCents === 0;
}

export function buildCompletedRequirements(
  input: RegistrationProgressInput,
): RegistrationCompletedRequirement[] {
  return [
    {
      id: "profile",
      label: "Attendee profile",
      complete: profileComplete(input),
    },
    {
      id: "product",
      label: "Registration product",
      complete: input.hasProduct,
    },
    {
      id: "group",
      label: "Group members",
      complete: groupComplete(input),
    },
    {
      id: "policy",
      label: "Policy acceptance",
      complete: input.policyAccepted,
    },
    {
      id: "submitted",
      label: "Group submitted",
      complete: submittedComplete(input.status),
    },
    {
      id: "payment",
      label: "Payment complete",
      complete: paymentComplete(input),
    },
  ];
}

/**
 * Maps the first incomplete requirement to a wizard step.
 * After submit, resume lands on payment/complete surfaces (7/8).
 */
export function deriveRegistrationResumeStep(input: RegistrationProgressInput): number {
  if (input.status === "none") {
    return REGISTRATION_WIZARD_STEPS.ATTENDEE_INFORMATION;
  }

  if (input.status === "payment_pending" || input.status === "submitted") {
    return REGISTRATION_WIZARD_STEPS.PAYMENT_SUBMIT;
  }

  if (input.status === "confirmed") {
    return REGISTRATION_WIZARD_STEPS.COMPLETE;
  }

  if (input.status === "canceled" || input.status === "refunded") {
    return REGISTRATION_WIZARD_STEPS.ATTENDEE_INFORMATION;
  }

  const requirements = buildCompletedRequirements(input);
  const firstIncomplete = requirements.find((requirement) => !requirement.complete);
  if (!firstIncomplete) {
    return REGISTRATION_WIZARD_STEPS.COMPLETE;
  }
  return REQUIREMENT_STAGE_TO_WIZARD_STEP[firstIncomplete.id];
}

/**
 * Query `?step=` expresses navigation intent only.
 * Permission is always derived from evaluator allowed destinations.
 */
export function resolveRegisterWizardIntent(input: {
  requestedStep?: string | null;
  requirements: Pick<
    RegistrationRequirementsResult,
    "resumeStep" | "resumeStepId" | "allowedStepDestinations"
  >;
}): {
  activeStepNumber: number;
  activeStepId: RegistrationStepId | "complete";
  intentAllowed: boolean;
  clampedFromIllegalIntent: boolean;
} {
  const requested = input.requestedStep?.trim().toLowerCase() ?? "";
  const allowedDestinations = new Set(
    input.requirements.allowedStepDestinations.map(({ destination }) => destination),
  );

  if (
    requested &&
    allowedDestinations.has(requested as RegistrationStepDestination) &&
    requested !== "complete"
  ) {
    const matched = input.requirements.allowedStepDestinations.find(
      ({ destination }) => destination === requested,
    );
    return {
      activeStepNumber: matched?.step ?? input.requirements.resumeStep,
      activeStepId: requested as RegistrationStepId,
      intentAllowed: true,
      clampedFromIllegalIntent: false,
    };
  }

  const resumeId =
    input.requirements.resumeStepId === "complete"
      ? "payment"
      : input.requirements.resumeStepId;

  return {
    activeStepNumber: input.requirements.resumeStep,
    activeStepId: resumeId,
    intentAllowed: !requested,
    clampedFromIllegalIntent: Boolean(requested),
  };
}

export function evaluateRegistrationRequirements(
  input: RegistrationRequirementsInput,
): RegistrationRequirementsResult {
  const progressInput: RegistrationProgressInput = {
    status: input.status,
    hasProduct: input.hasProduct,
    missingProfileFields: input.missingProfileFields,
    groupMemberCount: input.groupMemberCount,
    juniorMissingDob: input.juniorMissingDob,
    policyAccepted: input.policyAccepted,
    remainingBalanceCents: input.remainingBalanceCents,
    requiredProfileFieldCount: input.requiredProfileFieldCount,
  };

  const completedRequirements = buildCompletedRequirements(progressInput);
  const totalCompletionPercent = calculateRegistrationProgress(progressInput);
  const resumeStep = deriveRegistrationResumeStep(progressInput);
  const resumeStepId = RESUME_STEP_IDS[resumeStep] ?? "attendee";
  // Review is the first incomplete requirement before submission, but the
  // payment/submit screen is the action that completes it. Once every prior
  // requirement is persisted, both screens are valid destinations.
  const canSubmitGroup =
    input.status === "draft" &&
    completedRequirements
      .filter(({ id }) => id !== "submitted" && id !== "payment")
      .every(({ complete }) => complete);
  const allowedStepDestinations = STEP_DESTINATIONS.filter(({ step }) =>
    input.status === "confirmed" || step <= resumeStep ||
    (step === REGISTRATION_WIZARD_STEPS.PAYMENT_SUBMIT && canSubmitGroup),
  ).map((destination) => ({ ...destination }));

  return {
    completedRequirements,
    blockers: buildRegistrationBlockers(input),
    totalCompletionPercent,
    resumeStep,
    resumeStepId,
    allowedStepDestinations,
    journey: registrationJourneySteps(input.status, input.credentialReady),
    nextActions: buildRegistrationNextActions(input),
  };
}
