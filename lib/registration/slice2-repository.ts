import "server-only";

import { createHash } from "node:crypto";

import { attemptRegistrationCredentialIssuance } from "@/lib/registration/post-fulfillment";
import { DEFAULT_PROGRAM_KEY } from "@/lib/registration/types";
import { RegistrationError } from "@/lib/registration/errors";
import {
  GROUP_RELATIONSHIPS,
  normalizeInterpretation,
  validateAddress,
  validateJunior,
  validateSignature,
} from "@/lib/registration/slice2-validation";
import {
  isJuniorRegistrationProduct,
  type GroupRegistrant,
  type RegistrationExperience,
  type RegistrationGroup,
  type RegistrationPolicy,
  type RegistrationProduct,
} from "@/lib/registration/group-experience";
import { getSupabaseAdmin } from "@/lib/supabase/server";

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

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
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
    .select("id,status,registrations(*)")
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
    mobile_phone: isPrimary ? requireValue(input.mobilePhone, "Cell phone") : null,
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
  const [{ data: products, error: productsError }, { data: group, error: groupError }, { data: policy, error: policyError }] =
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
        .select("id,status,registrations(*)")
        .eq("program_key", DEFAULT_PROGRAM_KEY)
        .eq("owner_user_id", userId)
        .maybeSingle(),
      db
        .from("registration_policies")
        .select("id,version,title,content,content_hash,effective_at")
        .eq("program_key", DEFAULT_PROGRAM_KEY)
        .eq("status", "published")
        .maybeSingle(),
    ]);

  if (productsError || groupError || policyError) {
    throw productsError ?? groupError ?? policyError;
  }

  const now = new Date();
  return {
    products: ((products ?? []) as RegistrationProductRow[]).filter((product) =>
      isProductSelectable(product, now),
    ),
    group: (group as RegistrationGroup | null) ?? null,
    policy: (policy as RegistrationPolicy | null) ?? null,
  };
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
  const nextStatus = totalCents === 0 ? "confirmed" : "submitted";
  const now = new Date().toISOString();

  for (const member of members) {
    const product = products.get(member.registration_product_id ?? "");
    const { error } = await db
      .from("registrations")
      .update({ amount_cents: product?.price_cents ?? 0, currency: product?.currency ?? "usd", updated_by: userId })
      .eq("id", member.id)
      .eq("registration_group_id", group.id)
      .eq("status", "draft");
    if (error) {
      throw error;
    }
  }

  const { data: transitioned, error: transitionError } = await db
    .from("registrations")
    .update({
      status: nextStatus,
      submitted_at: now,
      confirmed_at: totalCents === 0 ? now : null,
      updated_by: userId,
    })
    .eq("registration_group_id", group.id)
    .eq("status", "draft")
    .select("id");
  if (transitionError) {
    throw transitionError;
  }
  if ((transitioned ?? []).length !== members.length) {
    throw new RegistrationError("conflict", "Registration changed while it was being submitted. Please review it again.");
  }

  const { error: primaryTotalError } = await db
    .from("registrations")
    .update({ amount_cents: totalCents, updated_by: userId })
    .eq("id", primary.id)
    .eq("registration_group_id", group.id);
  if (primaryTotalError) {
    throw primaryTotalError;
  }

  const { error: groupError } = await db
    .from("registration_groups")
    .update({ status: nextStatus })
    .eq("id", group.id)
    .eq("owner_user_id", userId)
    .eq("status", "draft");
  if (groupError) {
    throw groupError;
  }

  if (totalCents === 0) {
    for (const member of members) {
      await attemptRegistrationCredentialIssuance({ registrationId: member.id, actorUserId: userId });
    }
  }

  return {
    registrationId: primary.id,
    groupId: group.id,
    status: nextStatus,
    totalCents,
  };
}

export async function confirmPaidGroup(registrationId: string, actorUserId: string | null): Promise<void> {
  const db = getSupabaseAdmin();
  const { data: primary, error: primaryError } = await db
    .from("registrations")
    .select("registration_group_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (primaryError) {
    throw primaryError;
  }
  if (!primary?.registration_group_id) {
    return;
  }

  const now = new Date().toISOString();
  const { data: members, error: membersError } = await db
    .from("registrations")
    .update({ status: "confirmed", confirmed_at: now, updated_by: actorUserId })
    .eq("registration_group_id", primary.registration_group_id)
    .in("status", ["submitted", "payment_pending"])
    .select("id");
  if (membersError) {
    throw membersError;
  }

  const { error: groupError } = await db
    .from("registration_groups")
    .update({ status: "confirmed" })
    .eq("id", primary.registration_group_id);
  if (groupError) {
    throw groupError;
  }

  for (const member of members ?? []) {
    await attemptRegistrationCredentialIssuance({ registrationId: member.id, actorUserId });
  }
}
