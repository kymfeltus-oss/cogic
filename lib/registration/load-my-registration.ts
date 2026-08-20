import "server-only";

import { getUserFromSession } from "@/lib/auth/session";
import { loadDashboardHousingSummary } from "@/lib/dashboard/load-dashboard-housing";
import { loadDashboardTicketsSummary } from "@/lib/dashboard/load-dashboard-tickets";
import { getRegistrationForUser } from "@/lib/registration/repository";
import {
  buildRegistrationNextActions,
  maskBadgeCode,
  moneyLabel,
  registrationJourneySteps,
  type MyRegistrationBlocker,
} from "@/lib/registration/my-registration-state";
import {
  evaluateRegistrationRequirements,
  type RegistrationCompletedRequirement,
} from "@/lib/registration/registration-requirements";
import {
  DEFAULT_PROGRAM_KEY,
  type RegistrationStatus,
  type RegistrationStepId,
} from "@/lib/registration/types";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const REQUIRED_PROFILE = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["email", "Email"],
  ["mobile_phone", "Mobile phone"],
  ["street_address", "Address line 1"],
  ["city", "City"],
  ["postal_code", "Postal code"],
  ["country_code", "Country"],
  ["state", "State / Province"],
  ["church_name", "Church name"],
  ["pastor_name", "Pastor name"],
  ["jurisdiction", "Jurisdiction"],
] as const;

export type MyRegistrationDashboard = {
  signedIn: boolean;
  programKey: string;
  state:
    | "unauthorized"
    | "none"
    | "draft"
    | "submitted"
    | "payment_pending"
    | "confirmed"
    | "canceled"
    | "refunded"
    | "error";
  error: string | null;
  progress: number;
  resumeStep: number;
  resumeStepId: RegistrationStepId | "complete";
  completedRequirements: RegistrationCompletedRequirement[];
  summary: {
    status: RegistrationStatus | "none";
    productName: string | null;
    productPriceCents: number | null;
    productPriceLabel: string;
    amountPaidCents: number;
    amountPaidLabel: string;
    remainingBalanceCents: number;
    remainingBalanceLabel: string;
    totalAmountCents: number;
    totalAmountLabel: string;
    paymentStatus: string | null;
    credentialStatus: string | null;
    credentialReady: boolean;
    groupMemberCount: number;
    housingStatus: string | null;
    housingPreference: string | null;
    currency: string;
  };
  journey: ReturnType<typeof registrationJourneySteps>;
  nextActions: ReturnType<typeof buildRegistrationNextActions>;
  blockers: MyRegistrationBlocker[];
  profile: Record<string, string | null>;
  editable: boolean;
  members: Array<{
    registrationId: string;
    name: string;
    relationship: string;
    isPrimary: boolean;
    isJunior: boolean;
    productName: string | null;
    dateOfBirth: string | null;
    status: string;
    paymentState: string | null;
    credentialStatus: string;
    badgeCodeMasked: string | null;
    credentialIssuedAt: string | null;
    credentialRotatedAt: string | null;
    canPresentCredential: boolean;
    canEdit: boolean;
    canRemove: boolean;
  }>;
  payments: Array<{
    id: string;
    createdAt: string;
    description: string;
    amountCents: number;
    amountLabel: string;
    status: string;
    stripeReference: string | null;
  }>;
  policy: {
    required: boolean;
    accepted: boolean;
    version: string | null;
    title: string | null;
    signerName: string | null;
    acceptedAt: string | null;
    snapshot: string | null;
    acceptHref: string;
  };
  housing: {
    preference: string | null;
    status: string | null;
    hotelName: string | null;
    blockName: string | null;
    arrival: string | null;
    departure: string | null;
    summary: string;
    href: string;
  };
  addOns: {
    issuedTicketCount: number;
    summary: string;
    href: string;
  };
  travel: {
    hasActivity: boolean;
    href: string;
  };
  credentials: Array<{
    registrationId: string;
    name: string;
    status: string;
    badgeCodeMasked: string | null;
    issuedAt: string | null;
    rotatedAt: string | null;
    canPresent: boolean;
    message: string;
  }>;
};

function emptyDashboard(
  overrides: Partial<MyRegistrationDashboard> & Pick<MyRegistrationDashboard, "state" | "signedIn">,
): MyRegistrationDashboard {
  return {
    programKey: DEFAULT_PROGRAM_KEY,
    error: null,
    progress: 0,
    resumeStep: 1,
    resumeStepId: "attendee",
    completedRequirements: [],
    summary: {
      status: "none",
      productName: null,
      productPriceCents: null,
      productPriceLabel: "—",
      amountPaidCents: 0,
      amountPaidLabel: moneyLabel(0),
      remainingBalanceCents: 0,
      remainingBalanceLabel: moneyLabel(0),
      totalAmountCents: 0,
      totalAmountLabel: moneyLabel(0),
      paymentStatus: null,
      credentialStatus: null,
      credentialReady: false,
      groupMemberCount: 0,
      housingStatus: null,
      housingPreference: null,
      currency: "usd",
    },
    journey: registrationJourneySteps("none", false),
    nextActions: buildRegistrationNextActions({
      status: "none",
      hasProduct: false,
      missingProfileFields: [],
      groupMemberCount: 0,
      juniorMissingDob: false,
      policyAccepted: false,
      totalAmountCents: 0,
      amountPaidCents: 0,
      remainingBalanceCents: 0,
      paymentStatus: null,
      credentialReady: false,
      credentialMissingWhileConfirmed: false,
      housingPreference: null,
      housingStatus: null,
      hasTravelActivity: false,
    }),
    blockers: [],
    profile: {},
    editable: false,
    members: [],
    payments: [],
    policy: {
      required: true,
      accepted: false,
      version: null,
      title: null,
      signerName: null,
      acceptedAt: null,
      snapshot: null,
      acceptHref: "/register",
    },
    housing: {
      preference: null,
      status: null,
      hotelName: null,
      blockName: null,
      arrival: null,
      departure: null,
      summary: "No housing preference submitted.",
      href: "/housing",
    },
    addOns: {
      issuedTicketCount: 0,
      summary: "No issued event tickets.",
      href: "/tickets",
    },
    travel: { hasActivity: false, href: "/travel" },
    credentials: [],
    ...overrides,
  };
}

async function hasTravelActivity(userId: string) {
  try {
    const db = getSupabaseAdmin();
    const hotels = await db
      .from("travel_hotel_reservations")
      .select("id")
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .eq("user_id", userId)
      .limit(1);
    if (hotels.data?.length) return true;
    const attempts = await db
      .from("travel_marketplace_booking_attempts")
      .select("id")
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .eq("user_id", userId)
      .limit(1);
    return Boolean(attempts.data?.length);
  } catch {
    return false;
  }
}

export async function loadMyRegistrationDashboard(
  userId?: string | null,
): Promise<MyRegistrationDashboard> {
  try {
    const sessionUser = userId ? { id: userId } : await getUserFromSession();
    if (!sessionUser?.id) {
      return emptyDashboard({
        signedIn: false,
        state: "unauthorized",
        nextActions: [
          {
            id: "open_dashboard",
            label: "Open My Convocation",
            href: "/my-convocation",
            priority: 1,
            reason: "Open My Convocation to continue.",
          },
        ],
      });
    }

    const registration = await getRegistrationForUser({ userId: sessionUser.id });
    if (!registration) {
      return emptyDashboard({
        signedIn: true,
        state: "none",
      });
    }

    const db = getSupabaseAdmin();
    const { data: primaryRow } = await db
      .from("registrations")
      .select("*")
      .eq("id", registration.id)
      .eq("program_key", DEFAULT_PROGRAM_KEY)
      .eq("user_id", sessionUser.id)
      .maybeSingle();

    if (!primaryRow) {
      return emptyDashboard({
        signedIn: true,
        state: "none",
      });
    }

    const groupId = primaryRow.registration_group_id as string | null;
    const [
      memberResult,
      acceptanceResult,
      publishedPolicyResult,
      housing,
      tickets,
      travelActive,
    ] = await Promise.all([
      groupId
        ? db
            .from("registrations")
            .select(
              "id,user_id,first_name,last_name,salutation,suffix,email,mobile_phone,assistant_email,street_address,address_line_2,city,state,postal_code,country_code,gender,church_name,pastor_name,jurisdiction,requires_interpretation,preferred_language,date_of_birth,relationship_to_primary,is_primary_registrant,status,amount_cents,currency,registration_product_id,registration_products(name,price_cents,currency),registration_credentials(status,badge_code,issued_at,rotated_at,credential_version),registration_payments(id,status,amount_cents,currency,stripe_session_id,stripe_payment_intent_id,created_at)",
            )
            .eq("registration_group_id", groupId)
            .eq("program_key", DEFAULT_PROGRAM_KEY)
            .order("is_primary_registrant", { ascending: false })
        : Promise.resolve({ data: [primaryRow] }),
      groupId
        ? db
            .from("registration_policy_acceptances")
            .select("policy_version,policy_snapshot,agreement_signer_name,accepted_at")
            .eq("registration_group_id", groupId)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      db
        .from("registration_policies")
        .select("version,title")
        .eq("program_key", DEFAULT_PROGRAM_KEY)
        .eq("status", "published")
        .maybeSingle(),
      loadDashboardHousingSummary(sessionUser.id),
      loadDashboardTicketsSummary(sessionUser.id),
      hasTravelActivity(sessionUser.id),
    ]);

    const membersRaw = (memberResult.data ?? []) as Array<Record<string, unknown>>;
    const status = (primaryRow.status as RegistrationStatus) || "draft";
    const product = Array.isArray(primaryRow.registration_products)
      ? primaryRow.registration_products[0]
      : null;

    // Load product via join if not embedded on primaryRow from select("*")
    let productName: string | null = null;
    let productPriceCents: number | null = primaryRow.amount_cents ?? null;
    let currency = String(primaryRow.currency || "usd");

    const members = membersRaw.map((row) => {
      const p = Array.isArray(row.registration_products)
        ? (row.registration_products[0] as { name?: string; price_cents?: number; currency?: string } | undefined)
        : (row.registration_products as { name?: string; price_cents?: number; currency?: string } | null);
      const credentials = Array.isArray(row.registration_credentials)
        ? row.registration_credentials
        : [];
      const latest = [...credentials].sort(
        (a: { credential_version?: number }, b: { credential_version?: number }) =>
          Number(b.credential_version || 0) - Number(a.credential_version || 0),
      )[0] as
        | {
            status?: string;
            badge_code?: string | null;
            issued_at?: string | null;
            rotated_at?: string | null;
          }
        | undefined;
      const payments = Array.isArray(row.registration_payments) ? row.registration_payments : [];
      const paid = payments.some((pay: { status?: string }) => pay.status === "paid");
      const pending = payments.some((pay: { status?: string }) => pay.status === "pending");
      const isPrimary = Boolean(row.is_primary_registrant);
      const isJunior = row.relationship_to_primary === "child";
      const credentialStatus = latest?.status ?? "not_issued";
      const canPresent =
        row.status === "confirmed" &&
        (credentialStatus === "issued" || credentialStatus === "active");

      if (isPrimary) {
        productName = p?.name ?? productName;
        productPriceCents = Number(row.amount_cents ?? p?.price_cents ?? productPriceCents ?? 0);
        currency = String(row.currency || p?.currency || currency);
      }

      return {
        registrationId: String(row.id),
        name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Registrant",
        relationship: isPrimary
          ? "Primary"
          : String(row.relationship_to_primary || "other").replaceAll("_", " "),
        isPrimary,
        isJunior,
        productName: p?.name ?? null,
        dateOfBirth: (row.date_of_birth as string | null) ?? null,
        status: String(row.status || ""),
        paymentState: paid ? "paid" : pending ? "pending" : row.status === "confirmed" ? "paid" : "unpaid",
        credentialStatus,
        badgeCodeMasked: maskBadgeCode(latest?.badge_code),
        credentialIssuedAt: latest?.issued_at ?? null,
        credentialRotatedAt: latest?.rotated_at ?? null,
        canPresentCredential: canPresent,
        canEdit: status === "draft",
        canRemove: status === "draft" && !isPrimary,
      };
    });

    // If product join missing on * select, fetch product name
    if (!productName && primaryRow.registration_product_id) {
      const { data: prod } = await db
        .from("registration_products")
        .select("name,price_cents,currency")
        .eq("id", primaryRow.registration_product_id)
        .maybeSingle();
      productName = prod?.name ?? null;
      if (productPriceCents == null) productPriceCents = prod?.price_cents ?? null;
      if (prod?.currency) currency = prod.currency;
    }

    const totalAmountCents = membersRaw.reduce(
      (sum, row) => sum + Number(row.amount_cents || 0),
      0,
    );
    const paymentRows = membersRaw.flatMap((row) => {
      const payments = Array.isArray(row.registration_payments) ? row.registration_payments : [];
      return payments.map((pay: Record<string, unknown>) => ({
        id: String(pay.id),
        createdAt: String(pay.created_at || ""),
        description: "Holy Convocation registration",
        amountCents: Number(pay.amount_cents || 0),
        amountLabel: moneyLabel(Number(pay.amount_cents || 0), String(pay.currency || currency)),
        status: String(pay.status || ""),
        stripeReference:
          (pay.stripe_payment_intent_id as string | null) ||
          (pay.stripe_session_id as string | null) ||
          null,
      }));
    });
    const amountPaidCents = paymentRows
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amountCents, 0);
    const remainingBalanceCents = Math.max(0, totalAmountCents - amountPaidCents);

    const acceptance = acceptanceResult.data;
    const publishedPolicy = publishedPolicyResult.data;
    const missingProfileFields = REQUIRED_PROFILE.filter(([key]) => {
      const value = primaryRow[key];
      return value == null || String(value).trim() === "";
    }).map(([, label]) => label);

    // country_code may be absent on older rows — don't block if address exists
    const filteredMissing: string[] = missingProfileFields.filter((label) => {
      if (label !== "Country") return true;
      return !primaryRow.street_address;
    });

    if (
      primaryRow.requires_interpretation &&
      !String(primaryRow.preferred_language ?? "").trim()
    ) {
      filteredMissing.push("Preferred interpretation language");
    }

    const juniorMissingDob = members.some((m) => m.isJunior && !m.dateOfBirth);
    const credentialReady = members.some(
      (m) =>
        m.isPrimary &&
        (m.credentialStatus === "issued" || m.credentialStatus === "active"),
    );
    const primaryCredential = members.find((m) => m.isPrimary);
    const credentialMissingWhileConfirmed =
      status === "confirmed" && !credentialReady;

    const stateInput = {
      status,
      hasProduct: Boolean(primaryRow.registration_product_id || productName),
      missingProfileFields: status === "draft" ? filteredMissing : [],
      groupMemberCount: members.length,
      juniorMissingDob: status === "draft" && juniorMissingDob,
      policyAccepted: Boolean(acceptance),
      totalAmountCents,
      amountPaidCents,
      remainingBalanceCents,
      paymentStatus: paymentRows[0]?.status ?? null,
      credentialReady,
      credentialMissingWhileConfirmed,
      housingPreference: housing.preference,
      housingStatus: housing.status,
      hasTravelActivity: travelActive,
    };
    const requirements = evaluateRegistrationRequirements({
      ...stateInput,
      requiredProfileFieldCount:
        REQUIRED_PROFILE.length + (primaryRow.requires_interpretation ? 1 : 0),
    });

    const profile = {
      salutation: (primaryRow.salutation as string | null) ?? null,
      firstName: (primaryRow.first_name as string | null) ?? null,
      lastName: (primaryRow.last_name as string | null) ?? null,
      suffix: (primaryRow.suffix as string | null) ?? null,
      email: (primaryRow.email as string | null) ?? null,
      mobilePhone: (primaryRow.mobile_phone as string | null) ?? null,
      assistantEmail: (primaryRow.assistant_email as string | null) ?? null,
      country: (primaryRow.country_code as string | null) ?? null,
      addressLine1: (primaryRow.street_address as string | null) ?? null,
      addressLine2: (primaryRow.address_line_2 as string | null) ?? null,
      city: (primaryRow.city as string | null) ?? null,
      state: (primaryRow.state as string | null) ?? null,
      postalCode: (primaryRow.postal_code as string | null) ?? null,
      gender: (primaryRow.gender as string | null) ?? null,
      churchName: (primaryRow.church_name as string | null) ?? null,
      pastorName: (primaryRow.pastor_name as string | null) ?? null,
      jurisdiction: (primaryRow.jurisdiction as string | null) ?? null,
      interpretation: primaryRow.requires_interpretation
        ? (primaryRow.preferred_language as string | null) || "Requested"
        : "Not requested",
      preferredLanguage: (primaryRow.preferred_language as string | null) ?? null,
      registrationProduct: productName,
      productPrice: moneyLabel(productPriceCents, currency),
    };

    void product;

    return {
      signedIn: true,
      programKey: DEFAULT_PROGRAM_KEY,
      state: status,
      error: null,
      progress: requirements.totalCompletionPercent,
      resumeStep: requirements.resumeStep,
      resumeStepId: requirements.resumeStepId,
      completedRequirements: requirements.completedRequirements,
      summary: {
        status,
        productName,
        productPriceCents,
        productPriceLabel: moneyLabel(productPriceCents, currency),
        amountPaidCents,
        amountPaidLabel: moneyLabel(amountPaidCents, currency),
        remainingBalanceCents,
        remainingBalanceLabel: moneyLabel(remainingBalanceCents, currency),
        totalAmountCents,
        totalAmountLabel: moneyLabel(totalAmountCents, currency),
        paymentStatus: paymentRows.find((p) => p.status === "paid")?.status ?? paymentRows[0]?.status ?? null,
        credentialStatus: primaryCredential?.credentialStatus ?? null,
        credentialReady,
        groupMemberCount: members.length,
        housingStatus: housing.status,
        housingPreference: housing.preference,
        currency,
      },
      journey: requirements.journey,
      nextActions: requirements.nextActions,
      blockers: requirements.blockers,
      profile,
      editable: status === "draft",
      members,
      payments: paymentRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      policy: {
        required: true,
        accepted: Boolean(acceptance),
        version: acceptance?.policy_version ?? publishedPolicy?.version ?? null,
        title: publishedPolicy?.title ?? null,
        signerName: acceptance?.agreement_signer_name ?? null,
        acceptedAt: acceptance?.accepted_at ?? null,
        snapshot: acceptance?.policy_snapshot ?? null,
        acceptHref: "/register",
      },
      housing: {
        preference: housing.preference,
        status: housing.status,
        hotelName: housing.hotelName,
        blockName: housing.blockName,
        arrival: housing.arrival,
        departure: housing.departure,
        summary: housing.summary,
        href: "/housing",
      },
      addOns: {
        issuedTicketCount: tickets.validCount,
        summary: tickets.summary,
        href: "/tickets",
      },
      travel: {
        hasActivity: travelActive,
        href: "/travel",
      },
      credentials: members.map((m) => ({
        registrationId: m.registrationId,
        name: m.name,
        status: m.credentialStatus,
        badgeCodeMasked: m.badgeCodeMasked,
        issuedAt: m.credentialIssuedAt,
        rotatedAt: m.credentialRotatedAt,
        canPresent: m.canPresentCredential,
        message: m.canPresentCredential
          ? "Secure credential ready."
          : status === "confirmed"
            ? m.credentialStatus === "revoked"
              ? "Credential revoked."
              : "Credential not available yet."
            : "Credential available after confirmation.",
      })),
    };
  } catch (error) {
    return emptyDashboard({
      signedIn: true,
      state: "error",
      error: error instanceof Error ? error.message : "Unable to load registration.",
    });
  }
}
