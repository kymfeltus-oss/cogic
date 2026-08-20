import "server-only";

import { createHash } from "node:crypto";

import { attemptRegistrationCredentialIssuance } from "@/lib/registration/post-fulfillment";
import {
  DEFAULT_PROGRAM_KEY,
  type RegistrationAtomicTransitionResult,
  type RegistrationPrimaryDraftInput,
  type RegistrationPrimaryDraftResult,
  type RegistrationVersionContract,
} from "@/lib/registration/types";
import { mapDatabaseError, RegistrationError } from "@/lib/registration/errors";
import {
  GROUP_RELATIONSHIPS,
  normalizeInterpretation,
  validateAddress,
  validateJunior,
  validateSignature,
} from "@/lib/registration/slice2-validation";
import {
  getGroupTotalCents,
  getPrimaryRegistrant,
  isJuniorRegistrationProduct,
  type GroupRegistrant,
  type RegistrationExperience,
  type RegistrationGroup,
  type RegistrationPolicy,
  type RegistrationProduct,
} from "@/lib/registration/group-experience";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { evaluateRegistrationRequirements } from "@/lib/registration/registration-requirements";

export const PROGRAM_DATE_2026 = "2026-11-03";

const ACTIVE_REGISTRATION_STATUSES = ["submitted", "payment_pending", "confirmed"];
const LEGACY_ACTIVE_REGISTRATION_STATUSES = ["draft", ...ACTIVE_REGISTRATION_STATUSES];

type RegistrationProductRow = RegistrationProduct & {
  active: boolean;
  public: boolean;
};

export type RegistrantInput = {
  id?: string;
  isPrimary: boolean;
  relationship?: string | null;
  guardianRegistrationId?: string | null;
  productId: string;
  salutation?: string | null;
  firstName: string;
  lastName: string;
  suffix?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  assistantEmail?: string | null;
  streetAddress?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  gender?: string | null;
  requiresInterpretation?: boolean;
  preferredLanguage?: string | null;
  dateOfBirth?: string | null;
  churchName?: string | null;
  pastorName?: string | null;
  jurisdiction?: string | null;
};

function memberVersionContract(members: GroupRegistrant[]): Record<string, number> {
  return Object.fromEntries(
    members.map((member) => [member.id, Number(member.row_version ?? 1)]),
  );
}

function primaryDraftPayload(input: RegistrationPrimaryDraftInput) {
  return {
    salutation: clean(input.salutation),
    first_name: clean(input.firstName),
    last_name: clean(input.lastName),
    suffix: clean(input.suffix),
    email: clean(input.email)?.toLowerCase() ?? null,
    mobile_phone: normalizePhone(input.mobilePhone),
    assistant_email: clean(input.assistantEmail)?.toLowerCase() ?? null,
    street_address: clean(input.streetAddress),
    address_line_2: clean(input.addressLine2),
    city: clean(input.city),
    state: clean(input.state),
    postal_code: clean(input.postalCode),
    country_code: clean(input.countryCode)?.toUpperCase() ?? null,
    gender: clean(input.gender),
    requires_interpretation: input.requiresInterpretation === true,
    preferred_language:
      input.requiresInterpretation === true ? clean(input.preferredLanguage) : null,
    church_name: clean(input.churchName),
    pastor_name: clean(input.pastorName),
    jurisdiction: clean(input.jurisdiction),
    draft_last_step: input.draftLastStep ?? "attendee",
  };
}

/**
 * Persist partial primary-attendee data. The authenticated user id is supplied
 * by the server route; price, status, group ownership, and totals are not part
 * of this contract and cannot be forwarded from the browser.
 */
export async function savePrimaryRegistrationDraft(
  userId: string,
  input: RegistrationPrimaryDraftInput,
  versions: RegistrationVersionContract = {},
): Promise<RegistrationPrimaryDraftResult> {
  const authenticatedUserId = requireValue(userId, "Authenticated user");
  const { data, error } = await getSupabaseAdmin().rpc("save_registration_primary_draft", {
    p_user_id: authenticatedUserId,
    p_program_key: DEFAULT_PROGRAM_KEY,
    p_draft: primaryDraftPayload(input),
    p_expected_group_version: versions.groupVersion ?? null,
    p_expected_registration_version: versions.registrationVersion ?? null,
  });
  if (error) {
    throw mapDatabaseError(error);
  }
  const payload = data as Record<string, unknown> | null;
  if (!payload?.group_id || !payload.registration_id) {
    throw new RegistrationError("unavailable", "Unable to persist registration draft.");
  }
  return {
    groupId: String(payload.group_id),
    groupVersion: Number(payload.group_version ?? 1),
    registrationId: String(payload.registration_id),
    registrationVersion: Number(payload.registration_version ?? 1),
    status: "draft",
    draftLastStep: (payload.draft_last_step as RegistrationPrimaryDraftResult["draftLastStep"]) ?? null,
  };
}

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizePhone(value: string | null | undefined): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 8 && digits.length <= 15 && raw.startsWith("+")) return `+${digits}`;
  throw new RegistrationError("validation", "Enter a valid mobile phone number including country code.");
}

function requireValue(value: string | null | undefined, label: string): string {
  const normalized = clean(value);
  if (!normalized) {
    throw new RegistrationError("validation", `${label} is required.`);
  }
  return normalized;
}

function requireGroupRelationship(value: string | null | undefined): string {
  const relationship = clean(value);
  if (!relationship || !GROUP_RELATIONSHIPS.includes(relationship as (typeof GROUP_RELATIONSHIPS)[number])) {
    throw new RegistrationError("validation", "Choose a valid relationship for this registrant.");
  }
  return relationship;
}

function isProductSelectable(product: RegistrationProductRow, now: Date): boolean {
  if (!product.active || !product.public || product.capacity === 0) {
    return false;
  }

  const opensAt = product.registration_opens_at ? new Date(product.registration_opens_at) : null;
  const closesAt = product.registration_closes_at ? new Date(product.registration_closes_at) : null;

  return (!opensAt || opensAt <= now) && (!closesAt || closesAt >= now);
}

async function getSelectableProduct(productId: string): Promise<RegistrationProductRow> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("registration_products")
    .select(
      "id,product_key,name,description,eligibility_description,price_cents,currency,registration_opens_at,registration_closes_at,capacity,badge_type,active,public",
    )
    .eq("id", productId)
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || !isProductSelectable(data as RegistrationProductRow, new Date())) {
    throw new RegistrationError(
      "unavailable",
      "The selected registration product is no longer available.",
    );
  }

  return data as RegistrationProductRow;
}

async function findActiveLegacyRegistration(userId: string): Promise<GroupRegistrant | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("registrations")
    .select("*")
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .eq("user_id", userId)
    .is("registration_group_id", null)
    .in("status", LEGACY_ACTIVE_REGISTRATION_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data as GroupRegistrant | null) ?? null;
}

async function ensureGroup(userId: string): Promise<RegistrationGroup> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("registration_groups")
    .upsert(
      {
        program_key: DEFAULT_PROGRAM_KEY,
        owner_user_id: userId,
      },
      { onConflict: "program_key,owner_user_id" },
    )
    .select("id,status,row_version,wizard_resume_step,wizard_metadata,registrations(*)")
    .single();

  if (error || !data) {
    throw error ?? new RegistrationError("unavailable", "Unable to start registration.");
  }

  const group = data as RegistrationGroup;
  if (group.registrations?.length) {
    return group;
  }

  const legacy = await findActiveLegacyRegistration(userId);
  if (!legacy) {
    return group;
  }

  const { data: attachedRegistration, error: attachmentError } = await db
    .from("registrations")
    .update({ registration_group_id: group.id, is_primary_registrant: true, updated_by: userId })
    .eq("id", legacy.id)
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .eq("user_id", userId)
    .is("registration_group_id", null)
    .in("status", LEGACY_ACTIVE_REGISTRATION_STATUSES)
    .select("*")
    .maybeSingle();
  if (attachmentError) {
    throw attachmentError;
  }
  if (!attachedRegistration) {
    return group;
  }

  const { error: groupError } = await db
    .from("registration_groups")
    .update({ status: legacy.status })
    .eq("id", group.id)
    .eq("owner_user_id", userId)
    .eq("status", "draft");
  if (groupError) {
    throw groupError;
  }

  return {
    ...group,
    status: legacy.status,
    registrations: [attachedRegistration as GroupRegistrant],
  };
}

async function ensureDraftGroup(userId: string): Promise<RegistrationGroup> {
  const group = await ensureGroup(userId);
  if (group.status !== "draft") {
    throw new RegistrationError(
      "not_editable",
      "This registration has already been submitted and can no longer be edited.",
    );
  }
  return group;
}

function assertPrimaryDetails(input: RegistrantInput): void {
  const countryCode = requireValue(input.countryCode, "Country");
  const addressError = validateAddress({
    countryCode,
    state: input.state ?? "",
    city: input.city ?? "",
    postalCode: input.postalCode ?? "",
  });
  if (addressError) {
    throw new RegistrationError("validation", addressError);
  }

  requireValue(input.firstName, "First name");
  requireValue(input.lastName, "Last name");
  const email = requireValue(input.email, "Email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RegistrationError("validation", "Enter a valid email address.");
  }
  requireValue(input.mobilePhone, "Cell phone");
  requireValue(input.streetAddress, "Address line 1");
  requireValue(input.city, "City");
  requireValue(input.postalCode, "Postal code");
  requireValue(input.churchName, "Church name");
  requireValue(input.pastorName, "Pastor name");
  requireValue(input.jurisdiction, "Jurisdiction");
}

function assertProductEligibility(input: RegistrantInput, product: RegistrationProductRow): void {
  const relationship = input.isPrimary ? null : requireGroupRelationship(input.relationship);
  const isJunior = isJuniorRegistrationProduct(product.product_key);

  if (isJunior && (input.isPrimary || relationship !== "child")) {
    throw new RegistrationError(
      "validation",
      "Junior Registration Guest is available only for a child registrant in this group.",
    );
  }

  if (!input.isPrimary && relationship === "child" && !isJunior) {
    throw new RegistrationError(
      "validation",
      "Child registrants must use the Junior Registration Guest product.",
    );
  }
}

async function getGroupPrimary(groupId: string): Promise<GroupRegistrant | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("registrations")
    .select("*")
    .eq("registration_group_id", groupId)
    .eq("is_primary_registrant", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as GroupRegistrant | null) ?? null;
}

async function assertJuniorGuardian(input: RegistrantInput, groupId: string): Promise<void> {
  const juniorError = validateJunior(
    input.dateOfBirth ?? "",
    PROGRAM_DATE_2026,
    input.guardianRegistrationId ?? null,
  );
  if (juniorError) {
    throw new RegistrationError("validation", juniorError);
  }

  const db = getSupabaseAdmin();
  const { data: guardian, error } = await db
    .from("registrations")
    .select("id")
    .eq("id", input.guardianRegistrationId ?? "")
    .eq("registration_group_id", groupId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!guardian) {
    throw new RegistrationError(
      "validation",
      "The selected guardian is not part of this registration group.",
    );
  }
}

function toRegistrantPayload(input: RegistrantInput, groupId: string, userId: string, product: RegistrationProductRow, primary: GroupRegistrant | null) {
  const isPrimary = input.isPrimary;
  const relationship = isPrimary ? null : requireGroupRelationship(input.relationship);
  const source = isPrimary ? input : primary;

  if (!source) {
    throw new RegistrationError(
      "validation",
      "Complete the primary attendee information before adding a group registrant.",
    );
  }

  const interpretation = normalizeInterpretation(
    isPrimary ? input.requiresInterpretation === true : Boolean(primary?.requires_interpretation),
    isPrimary ? input.preferredLanguage ?? null : primary?.preferred_language ?? null,
  );

  return {
    registration_group_id: groupId,
    is_primary_registrant: isPrimary,
    relationship_to_primary: relationship,
    guardian_registration_id: relationship === "child" ? input.guardianRegistrationId ?? null : null,
    registration_product_id: product.id,
    program_key: DEFAULT_PROGRAM_KEY,
    user_id: isPrimary ? userId : null,
    status: "draft",
    salutation: isPrimary ? clean(input.salutation) : null,
    first_name: requireValue(input.firstName, "First name"),
    last_name: requireValue(input.lastName, "Last name"),
    suffix: isPrimary ? clean(input.suffix) : null,
    email: isPrimary ? requireValue(input.email, "Email").toLowerCase() : null,
    mobile_phone: isPrimary ? normalizePhone(input.mobilePhone) : null,
    assistant_email: isPrimary ? clean(input.assistantEmail)?.toLowerCase() ?? null : null,
    street_address: isPrimary
      ? requireValue(input.streetAddress, "Address line 1")
      : requireValue(primary?.street_address, "Primary attendee address"),
    address_line_2: isPrimary ? clean(input.addressLine2) : primary?.address_line_2 ?? null,
    city: isPrimary ? requireValue(input.city, "City") : requireValue(primary?.city, "Primary attendee city"),
    state: isPrimary ? clean(input.state) : requireValue(primary?.state, "Primary attendee state"),
    postal_code: isPrimary
      ? requireValue(input.postalCode, "Postal code")
      : requireValue(primary?.postal_code, "Primary attendee postal code"),
    country_code: isPrimary
      ? requireValue(input.countryCode, "Country")
      : requireValue(primary?.country_code, "Primary attendee country"),
    gender: isPrimary ? clean(input.gender) : null,
    requires_interpretation: interpretation.requiresInterpretation,
    preferred_language: interpretation.preferredLanguage,
    date_of_birth: relationship === "child" ? clean(input.dateOfBirth) : null,
    church_name: isPrimary
      ? requireValue(input.churchName, "Church name")
      : requireValue(primary?.church_name, "Primary attendee church name"),
    pastor_name: isPrimary
      ? requireValue(input.pastorName, "Pastor name")
      : requireValue(primary?.pastor_name, "Primary attendee pastor name"),
    jurisdiction: isPrimary
      ? requireValue(input.jurisdiction, "Jurisdiction")
      : requireValue(primary?.jurisdiction, "Primary attendee jurisdiction"),
    amount_cents: product.price_cents,
    currency: product.currency,
    updated_by: userId,
  };
}

export async function loadRegistrationExperience(userId: string): Promise<RegistrationExperience> {
  const db = getSupabaseAdmin();
  const [{ data: products, error: productsError }, { data: group, error: groupError }, { data: policy, error: policyError }, { data: attendee }] =
    await Promise.all([
      db
        .from("registration_products")
        .select(
          "id,product_key,name,description,eligibility_description,price_cents,currency,registration_opens_at,registration_closes_at,capacity,badge_type,active,public",
        )
        .eq("program_key", DEFAULT_PROGRAM_KEY)
        .eq("active", true)
        .eq("public", true)
        .order("sort_order"),
      db
        .from("registration_groups")
        .select("id,status,row_version,wizard_resume_step,wizard_metadata,registrations(*)")
        .eq("program_key", DEFAULT_PROGRAM_KEY)
        .eq("owner_user_id", userId)
        .maybeSingle(),
      db
        .from("registration_policies")
        .select("id,version,title,content,content_hash,effective_at")
        .eq("program_key", DEFAULT_PROGRAM_KEY)
        .eq("status", "published")
        .maybeSingle(),
      db.from("attendees").select("first_name,last_name,email,phone,city,state").eq("id", userId).maybeSingle(),
    ]);

  if (productsError || groupError || policyError) {
    throw productsError ?? groupError ?? policyError;
  }

  const now = new Date();
  const base = {
    products: ((products ?? []) as RegistrationProductRow[]).filter((product) =>
      isProductSelectable(product, now),
    ),
    group: (group as RegistrationGroup | null) ?? null,
    policy: (policy as RegistrationPolicy | null) ?? null,
  };
  const members = base.group?.registrations ?? [];
  const primary = getPrimaryRegistrant(base.group);
  const [{ data: acceptance }, { data: housing }, { data: payments }] = base.group
    ? await Promise.all([
        db.from("registration_policy_acceptances").select("id").eq("registration_group_id", base.group.id).limit(1),
        db.from("housing_requests").select("preference").eq("registration_group_id", base.group.id).neq("status", "canceled").limit(1),
        primary
          ? db.from("registration_payments").select("status").eq("registration_id", primary.id).order("created_at", { ascending: false }).limit(1)
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const requiredFields: Array<[string, string | null | undefined]> = [
    ["First name", primary?.first_name], ["Last name", primary?.last_name], ["Email", primary?.email],
    ["Mobile phone", primary?.mobile_phone], ["Address line 1", primary?.street_address],
    ["City", primary?.city], ["State / Province", primary?.state], ["Postal code", primary?.postal_code],
    ["Country", primary?.country_code], ["Church name", primary?.church_name],
    ["Pastor name", primary?.pastor_name], ["Jurisdiction", primary?.jurisdiction],
  ];
  if (primary?.requires_interpretation) requiredFields.push(["Preferred language", primary.preferred_language]);
  const totalCents = getGroupTotalCents(base.group);
  const paymentStatus = (payments?.[0] as { status?: string } | undefined)?.status ?? null;
  const requirements = evaluateRegistrationRequirements({
    status: (base.group?.status ?? "none") as import("@/lib/registration/types").RegistrationStatus | "none",
    hasProduct: Boolean(primary?.registration_product_id),
    missingProfileFields: requiredFields.filter(([, value]) => !value?.trim()).map(([label]) => label),
    groupMemberCount: members.length,
    juniorMissingDob: members.some((member) => member.relationship_to_primary === "child" && !member.date_of_birth),
    policyAccepted: Boolean(acceptance?.length), totalAmountCents: totalCents,
    amountPaidCents: paymentStatus === "paid" ? totalCents : 0,
    remainingBalanceCents: base.group?.status === "confirmed" ? 0 : totalCents,
    paymentStatus, credentialReady: false, credentialMissingWhileConfirmed: false,
    housingPreference: (housing?.[0] as { preference?: string } | undefined)?.preference ?? null,
    housingStatus: null, hasTravelActivity: false, requiredProfileFieldCount: requiredFields.length,
  });
  const [{ data: ticketProducts }, { data: addonProducts }] = await Promise.all([
    db.from("ticket_products").select("id,product_key,name,description,price_cents,currency,per_order_limit").eq("program_key", DEFAULT_PROGRAM_KEY).eq("active", true).eq("public", true).order("sort_order"),
    db.from("addon_products").select("id,addon_key,name,description,price_cents,currency,max_quantity,fulfillment_type").eq("program_key", DEFAULT_PROGRAM_KEY).eq("active", true).eq("public", true).order("name"),
  ]);
  return {
    ...base,
    requirements,
    paymentStatus,
    profileDefaults: {
      firstName: attendee?.first_name ?? null,
      lastName: attendee?.last_name ?? null,
      email: attendee?.email ?? null,
      mobilePhone: attendee?.phone ?? null,
      city: attendee?.city ?? null,
      state: attendee?.state ?? null,
    },
    ticketProducts: ticketProducts ?? [],
    addonProducts: addonProducts ?? [],
  };
}

export async function acknowledgeBeforeYouBegin(
  userId: string,
  expectedGroupVersion: number | null,
) {
  const db = getSupabaseAdmin();
  const group = await ensureDraftGroup(userId);
  if (expectedGroupVersion != null && Number(group.row_version ?? 1) !== expectedGroupVersion) {
    throw new RegistrationError("conflict", "Registration changed while you were working. Reload and try again.");
  }
  const { data, error } = await db.rpc("acknowledge_registration_before_you_begin", {
    p_owner_user_id: userId,
    p_program_key: DEFAULT_PROGRAM_KEY,
    p_expected_group_version: Number(group.row_version ?? 1),
  });
  if (error) throw mapDatabaseError(error);
  return data as Record<string, unknown>;
}

export async function saveRegistrationExtras(input: {
  userId: string;
  expectedGroupVersion: number;
  musicalQuantity: number;
  printedProgram: boolean;
  digitalProgram: boolean;
  smsOptIn: boolean;
  emailOptIn: boolean;
}) {
  const { data, error } = await getSupabaseAdmin().rpc("save_registration_extras", {
    p_owner_user_id: input.userId,
    p_program_key: DEFAULT_PROGRAM_KEY,
    p_expected_group_version: input.expectedGroupVersion,
    p_musical_quantity: input.musicalQuantity,
    p_printed_program: input.printedProgram,
    p_digital_program: input.digitalProgram,
    p_sms_opt_in: input.smsOptIn,
    p_email_opt_in: input.emailOptIn,
  });
  if (error) throw mapDatabaseError(error);
  return data as Record<string, unknown>;
}

export async function loadOrMigrateRegistrationExperience(userId: string): Promise<RegistrationExperience> {
  const experience = await loadRegistrationExperience(userId);
  if (experience.group || !(await findActiveLegacyRegistration(userId))) {
    return experience;
  }

  await ensureGroup(userId);
  return loadRegistrationExperience(userId);
}

export async function saveRegistrant(userId: string, input: RegistrantInput) {
  // Initialization path: attendee information must persist before product
  // selection. The draft RPC deliberately excludes product, money and status.
  if (input.isPrimary && !clean(input.productId)) {
    return savePrimaryRegistrationDraft(userId, {
      salutation: input.salutation,
      firstName: input.firstName,
      lastName: input.lastName,
      suffix: input.suffix,
      email: input.email,
      mobilePhone: input.mobilePhone,
      assistantEmail: input.assistantEmail,
      streetAddress: input.streetAddress,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      countryCode: input.countryCode,
      gender: input.gender,
      requiresInterpretation: input.requiresInterpretation,
      preferredLanguage: input.preferredLanguage,
      churchName: input.churchName,
      pastorName: input.pastorName,
      jurisdiction: input.jurisdiction,
      draftLastStep: "product",
    });
  }
  const group = await ensureDraftGroup(userId);
  const product = await getSelectableProduct(requireValue(input.productId, "Registration product"));

  if (input.isPrimary) {
    assertPrimaryDetails(input);
  } else {
    requireValue(input.firstName, "Registrant first name");
    requireValue(input.lastName, "Registrant last name");
  }

  assertProductEligibility(input, product);
  if (!input.isPrimary && input.relationship === "child") {
    await assertJuniorGuardian(input, group.id);
  }

  const primary = input.isPrimary ? null : await getGroupPrimary(group.id);
  const payload = toRegistrantPayload(input, group.id, userId, product, primary);
  const db = getSupabaseAdmin();

  let existingId = clean(input.id);
  if (input.isPrimary && !existingId) {
    const currentPrimary = await getGroupPrimary(group.id);
    existingId = currentPrimary?.id ?? null;
  }

  if (existingId) {
    const query = db
      .from("registrations")
      .update(payload)
      .eq("id", existingId)
      .eq("registration_group_id", group.id)
      .eq("status", "draft");
    if (input.isPrimary) {
      query.eq("is_primary_registrant", true).eq("user_id", userId);
    } else {
      query.eq("is_primary_registrant", false);
    }
    const { data, error } = await query.select("*").maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw new RegistrationError("not_editable", "This registrant can no longer be changed.");
    }
    return data;
  }

  const { data, error } = await db
    .from("registrations")
    .insert({ ...payload, created_by: userId })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export async function removeGroupRegistrant(userId: string, id: string): Promise<void> {
  const group = await ensureDraftGroup(userId);
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("registrations")
    .delete()
    .eq("id", id)
    .eq("registration_group_id", group.id)
    .eq("is_primary_registrant", false)
    .eq("status", "draft");

  if (error) {
    throw error;
  }
}

export async function acceptPolicy(
  userId: string,
  input: { policyId: string; authorizedSignerName: string; agreementSignerName: string },
): Promise<void> {
  const group = await ensureDraftGroup(userId);
  const db = getSupabaseAdmin();
  const { data: policy, error: policyError } = await db
    .from("registration_policies")
    .select("id,version,content,content_hash,status")
    .eq("id", input.policyId)
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .eq("status", "published")
    .maybeSingle();

  if (policyError) {
    throw policyError;
  }
  if (!policy) {
    throw new RegistrationError("unavailable", "The active policy is unavailable.");
  }

  const authorized = validateSignature(input.authorizedSignerName);
  const agreement = validateSignature(input.agreementSignerName);
  const hash = createHash("sha256").update(policy.content).digest("hex");
  if (hash !== policy.content_hash) {
    throw new RegistrationError("unavailable", "Policy verification failed. Please try again later.");
  }

  const { error } = await db.from("registration_policy_acceptances").upsert(
    {
      registration_group_id: group.id,
      policy_id: policy.id,
      policy_version: policy.version,
      policy_content_hash: hash,
      policy_snapshot: policy.content,
      authorized_signer_name: authorized,
      agreement_signer_name: agreement,
      accepted_by_user_id: userId,
    },
    { onConflict: "registration_group_id,policy_id" },
  );

  if (error) {
    throw error;
  }
}

async function assertSubmissionProducts(
  members: Array<{ id: string; registration_product_id: string | null }>,
): Promise<Map<string, RegistrationProductRow>> {
  const productIds = [...new Set(members.map((member) => member.registration_product_id).filter(Boolean))] as string[];
  if (productIds.length !== members.length) {
    throw new RegistrationError("validation", "Every registrant must have one registration product.");
  }
  if (productIds.length === 0) {
    throw new RegistrationError("validation", "Every registrant must have one registration product.");
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("registration_products")
    .select(
      "id,product_key,name,description,eligibility_description,price_cents,currency,registration_opens_at,registration_closes_at,capacity,badge_type,active,public",
    )
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .in("id", productIds);
  if (error) {
    throw error;
  }

  const products = new Map((data ?? []).map((product) => [product.id, product as RegistrationProductRow]));
  if (products.size !== productIds.length) {
    throw new RegistrationError("unavailable", "One or more registration products are no longer available.");
  }

  for (const product of products.values()) {
    if (!isProductSelectable(product, new Date())) {
      throw new RegistrationError("unavailable", `${product.name} is no longer available.`);
    }
    if (product.capacity !== null) {
      const selectedCount = members.filter((member) => member.registration_product_id === product.id).length;
      const { count, error: countError } = await db
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("registration_product_id", product.id)
        .in("status", ACTIVE_REGISTRATION_STATUSES);
      if (countError) {
        throw countError;
      }
      if ((count ?? 0) + selectedCount > product.capacity) {
        throw new RegistrationError("unavailable", `${product.name} has reached capacity.`);
      }
    }
  }

  return products;
}

function assertSubmissionRegistrantDetails(
  member: GroupRegistrant,
  members: GroupRegistrant[],
  products: Map<string, RegistrationProductRow>,
): void {
  requireValue(member.first_name, "Registrant first name");
  requireValue(member.last_name, "Registrant last name");
  if (!member.registration_product_id) {
    throw new RegistrationError("validation", "Every registrant must have one registration product.");
  }

  const product = products.get(member.registration_product_id);
  if (!product) {
    throw new RegistrationError("unavailable", "One or more registration products are no longer available.");
  }

  if (member.is_primary_registrant) {
    const primaryInput: RegistrantInput = {
      isPrimary: true,
      productId: member.registration_product_id,
      firstName: member.first_name ?? "",
      lastName: member.last_name ?? "",
      email: member.email,
      mobilePhone: member.mobile_phone,
      streetAddress: member.street_address,
      city: member.city,
      state: member.state,
      postalCode: member.postal_code,
      countryCode: member.country_code,
      churchName: member.church_name,
      pastorName: member.pastor_name,
      jurisdiction: member.jurisdiction,
    };
    assertPrimaryDetails(primaryInput);
    assertProductEligibility(primaryInput, product);
    return;
  }

  const relationship = requireGroupRelationship(member.relationship_to_primary);
  const memberInput: RegistrantInput = {
    isPrimary: false,
    relationship,
    guardianRegistrationId: member.guardian_registration_id,
    productId: member.registration_product_id,
    firstName: member.first_name ?? "",
    lastName: member.last_name ?? "",
    dateOfBirth: member.date_of_birth,
  };
  assertProductEligibility(memberInput, product);
  if (relationship === "child") {
    const guardianExists = members.some((candidate) => candidate.id === member.guardian_registration_id);
    const juniorError = validateJunior(
      member.date_of_birth ?? "",
      PROGRAM_DATE_2026,
      guardianExists ? member.guardian_registration_id : null,
    );
    if (juniorError) {
      throw new RegistrationError("validation", juniorError);
    }
  }
}

export async function submitGroup(userId: string) {
  const group = await ensureDraftGroup(userId);
  const db = getSupabaseAdmin();
  const [{ data: registrations, error: registrationsError }, { data: policy, error: policyError }] = await Promise.all([
    db.from("registrations").select("*").eq("registration_group_id", group.id),
    db
      .from("registration_policies")
      .select("id,content_hash")
      .eq("program_key", DEFAULT_PROGRAM_KEY)
      .eq("status", "published")
      .maybeSingle(),
  ]);

  if (registrationsError || policyError) {
    throw registrationsError ?? policyError;
  }

  const members = (registrations ?? []) as GroupRegistrant[];
  const primary = members.find((member) => member.is_primary_registrant) ?? null;
  if (!primary) {
    throw new RegistrationError("validation", "Complete the primary attendee registration first.");
  }
  if (members.some((member) => member.status !== "draft")) {
    throw new RegistrationError("not_editable", "This registration has already been submitted.");
  }
  if (!policy) {
    throw new RegistrationError("unavailable", "A published registration policy is required before submission.");
  }

  const { data: acceptance, error: acceptanceError } = await db
    .from("registration_policy_acceptances")
    .select("id,policy_content_hash")
    .eq("registration_group_id", group.id)
    .eq("policy_id", policy.id)
    .maybeSingle();
  if (acceptanceError) {
    throw acceptanceError;
  }
  if (!acceptance || acceptance.policy_content_hash !== policy.content_hash) {
    throw new RegistrationError("validation", "Accept the current registration policy before submitting.");
  }

  const products = await assertSubmissionProducts(members);
  members.forEach((member) => assertSubmissionRegistrantDetails(member, members, products));

  const totalCents = members.reduce((total, member) => {
    const product = products.get(member.registration_product_id ?? "");
    return total + (product?.price_cents ?? 0);
  }, 0);
  const expectedMemberVersions = memberVersionContract(members);
  if (Object.keys(expectedMemberVersions).length !== members.length) {
    throw new RegistrationError(
      "conflict",
      "Registration member version snapshot is incomplete. Reload and try again.",
    );
  }

  const { data: transitionData, error: transitionError } = await db.rpc(
    "submit_registration_group",
    {
      p_user_id: userId,
      p_group_id: group.id,
      p_expected_group_version: Number(group.row_version ?? 1),
      p_expected_member_versions: expectedMemberVersions,
    },
  );
  if (transitionError) {
    throw mapDatabaseError(transitionError);
  }
  const transition = transitionData as Record<string, unknown> | null;
  if (!transition?.group_id || !transition.registration_id || !transition.status) {
    throw new RegistrationError("unavailable", "Registration submission did not return its authoritative state.");
  }
  const nextStatus = String(transition.status);
  const memberIds = Array.isArray(transition.member_ids)
    ? transition.member_ids.map((id) => String(id))
    : members.map((member) => member.id);

  if (totalCents === 0 || nextStatus === "confirmed") {
    for (const memberId of memberIds) {
      await attemptRegistrationCredentialIssuance({ registrationId: memberId, actorUserId: userId });
    }
  }

  return {
    registrationId: String(transition.registration_id),
    groupId: String(transition.group_id),
    status: nextStatus,
    totalCents: Number(transition.total_cents ?? totalCents),
    groupVersion: Number(transition.group_version ?? group.row_version ?? 1),
    memberIds,
  };
}

export async function confirmPaidGroup(registrationId: string, actorUserId: string | null): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data: primaryRow, error: primaryLookupError } = await db
    .from("registrations")
    .select("id,registration_group_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (primaryLookupError) {
    throw mapDatabaseError(primaryLookupError);
  }

  let expectedGroupVersion: number | null = null;
  let expectedMemberVersions: Record<string, number> | null = null;
  if (primaryRow?.registration_group_id) {
    const [{ data: groupRow, error: groupError }, { data: memberRows, error: membersLookupError }] =
      await Promise.all([
        db
          .from("registration_groups")
          .select("id,row_version")
          .eq("id", primaryRow.registration_group_id)
          .maybeSingle(),
        db
          .from("registrations")
          .select("id,row_version")
          .eq("registration_group_id", primaryRow.registration_group_id),
      ]);
    if (groupError) {
      throw mapDatabaseError(groupError);
    }
    if (membersLookupError) {
      throw mapDatabaseError(membersLookupError);
    }
    expectedGroupVersion = Number(groupRow?.row_version ?? 1);
    expectedMemberVersions = Object.fromEntries(
      (memberRows ?? []).map((member) => [String(member.id), Number(member.row_version ?? 1)]),
    );
  }

  const { data, error } = await db.rpc("confirm_paid_registration_group", {
    p_registration_id: registrationId,
    p_actor_user_id: actorUserId,
    p_expected_group_version: expectedGroupVersion,
    p_expected_member_versions: expectedMemberVersions,
  });
  if (error) {
    throw mapDatabaseError(error);
  }

  const payload = (data ?? {}) as {
    ok?: boolean;
    member_ids?: unknown;
    group_id?: string | null;
  };

  let memberIds: string[] = [];
  if (Array.isArray(payload.member_ids)) {
    memberIds = payload.member_ids.map((id) => String(id));
  } else if (!payload.group_id) {
    memberIds = [registrationId];
  } else {
    const { data: members, error: membersError } = await db
      .from("registrations")
      .select("id")
      .eq("registration_group_id", payload.group_id)
      .eq("status", "confirmed");
    if (membersError) {
      throw mapDatabaseError(membersError);
    }
    memberIds = (members ?? []).map((member) => String(member.id));
  }

  if (memberIds.length === 0) {
    memberIds = [registrationId];
  }

  let allCredentialsIssued = true;
  for (const memberId of memberIds) {
    const issuance = await attemptRegistrationCredentialIssuance({
      registrationId: memberId,
      actorUserId,
    });
    allCredentialsIssued &&= issuance.issued || issuance.idempotent || issuance.retryQueued === true;
  }
  return allCredentialsIssued;
}

export async function cancelRegistrationGroup(input: {
  groupId: string;
  actorUserId: string;
  reason: string;
  groupVersion: number;
  memberVersions: Record<string, number>;
}): Promise<RegistrationAtomicTransitionResult> {
  const { data, error } = await getSupabaseAdmin().rpc("cancel_registration_group", {
    p_group_id: input.groupId,
    p_actor_user_id: input.actorUserId,
    p_reason: input.reason,
    p_expected_group_version: input.groupVersion,
    p_expected_member_versions: input.memberVersions,
  });
  if (error) {
    throw mapDatabaseError(error);
  }
  const payload = data as Record<string, unknown> | null;
  if (!payload?.group_id || payload.status !== "canceled") {
    throw new RegistrationError("unavailable", "Registration group cancellation did not complete.");
  }
  return {
    groupId: String(payload.group_id),
    registrationId: payload.registration_id ? String(payload.registration_id) : undefined,
    status: "canceled",
    groupVersion: Number(payload.group_version ?? input.groupVersion),
    canceledMembers: Number(payload.canceled_members ?? 0),
  };
}
