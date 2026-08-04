import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { writeRegistrationAuditEvent } from "@/lib/registration/audit";
import { mapDatabaseError, RegistrationError } from "@/lib/registration/errors";
import {
  ACTIVE_REGISTRATION_STATUSES,
  DEFAULT_PROGRAM_KEY,
  DEFAULT_REGISTRATION_CURRENCY,
  mapRegistrationRow,
  type Registration,
  type RegistrationDraftInput,
  type RegistrationRow,
  type RegistrationSubmissionInput,
} from "@/lib/registration/types";
import {
  assertRegistrationSubmission,
  normalizeDraftInput,
} from "@/lib/registration/validation";
import { isRegistrationEditable } from "@/lib/registration/workflow";

export type GetRegistrationForUserInput = {
  programKey?: string;
  userId: string;
};

function requireUserId(userId: string): string {
  const trimmed = userId.trim();
  if (!trimmed) {
    throw new RegistrationError("auth_required", "Please sign in to continue registration.");
  }
  return trimmed;
}

function resolveProgramKey(_ignored?: string): string {
  // Server-controlled — client program_key is never trusted.
  return DEFAULT_PROGRAM_KEY;
}

/**
 * Latest registration for a user in a program (any status).
 * Server-only; caller must supply session-resolved userId.
 */
export async function getRegistrationForUser(
  input: GetRegistrationForUserInput,
): Promise<Registration | null> {
  const userId = requireUserId(input.userId);
  const programKey = resolveProgramKey(input.programKey);
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("registrations")
    .select("*")
    .eq("program_key", programKey)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw mapDatabaseError(error);
  }

  return data ? mapRegistrationRow(data as RegistrationRow) : null;
}

/**
 * Active registration for a user (draft/submitted/payment_pending/confirmed).
 */
export async function getActiveRegistrationForUser(
  input: GetRegistrationForUserInput,
): Promise<Registration | null> {
  const userId = requireUserId(input.userId);
  const programKey = resolveProgramKey(input.programKey);
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("registrations")
    .select("*")
    .eq("program_key", programKey)
    .eq("user_id", userId)
    .in("status", [...ACTIVE_REGISTRATION_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw mapDatabaseError(error);
  }

  return data ? mapRegistrationRow(data as RegistrationRow) : null;
}

/**
 * Active registration by email (duplicate prevention / resume).
 */
export async function getActiveRegistrationByEmail(input: {
  programKey?: string;
  email: string;
}): Promise<Registration | null> {
  const programKey = resolveProgramKey(input.programKey);
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new RegistrationError("validation", "Email is required.");
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("registrations")
    .select("*")
    .eq("program_key", programKey)
    .eq("email", email)
    .in("status", [...ACTIVE_REGISTRATION_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw mapDatabaseError(error);
  }

  return data ? mapRegistrationRow(data as RegistrationRow) : null;
}

export type UpsertRegistrationDraftInput = {
  /** Must be resolved from the authenticated session on the server. */
  userId: string;
  draft: RegistrationDraftInput;
  actorUserId?: string | null;
};

/**
 * Create or update the caller's active draft for a program.
 * Does not trust client-supplied identity or program_key.
 */
export async function upsertRegistrationDraft(
  input: UpsertRegistrationDraftInput,
): Promise<Registration> {
  const userId = requireUserId(input.userId);
  const programKey = resolveProgramKey();
  const draft = normalizeDraftInput(input.draft);
  const actorUserId = input.actorUserId?.trim() || userId;
  const admin = getSupabaseAdmin();

  const existing = await getActiveRegistrationForUser({ userId });

  if (existing && !isRegistrationEditable(existing.status)) {
    throw new RegistrationError(
      "not_editable",
      "This registration can no longer be edited.",
    );
  }

  if (draft.email) {
    const emailConflict = await getActiveRegistrationByEmail({ email: draft.email });
    if (emailConflict && emailConflict.userId !== userId) {
      throw new RegistrationError(
        "duplicate",
        "An active registration already exists for this email.",
      );
    }
  }

  if (existing) {
    // Merge partial step updates so Continue on step 1 does not wipe later fields.
    const payload = {
      program_key: programKey,
      user_id: userId,
      status: "draft" as const,
      first_name: draft.firstName !== undefined ? draft.firstName : existing.firstName,
      last_name: draft.lastName !== undefined ? draft.lastName : existing.lastName,
      email: draft.email !== undefined ? draft.email : existing.email,
      mobile_phone:
        draft.mobilePhone !== undefined ? draft.mobilePhone : existing.mobilePhone,
      street_address:
        draft.streetAddress !== undefined
          ? draft.streetAddress
          : existing.streetAddress,
      city: draft.city !== undefined ? draft.city : existing.city,
      state: draft.state !== undefined ? draft.state : existing.state,
      postal_code:
        draft.postalCode !== undefined ? draft.postalCode : existing.postalCode,
      church_name:
        draft.churchName !== undefined ? draft.churchName : existing.churchName,
      pastor_name:
        draft.pastorName !== undefined ? draft.pastorName : existing.pastorName,
      jurisdiction:
        draft.jurisdiction !== undefined
          ? draft.jurisdiction
          : existing.jurisdiction,
      amount_cents:
        draft.amountCents !== undefined ? draft.amountCents : existing.amountCents,
      currency: draft.currency || existing.currency || DEFAULT_REGISTRATION_CURRENCY,
      updated_by: actorUserId,
    };

    const { data, error } = await admin
      .from("registrations")
      .update(payload)
      .eq("id", existing.id)
      .eq("user_id", userId)
      .eq("status", "draft")
      .select("*")
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    const registration = mapRegistrationRow(data as RegistrationRow);
    await writeRegistrationAuditEvent({
      action: "registration.draft_updated",
      registrationId: registration.id,
      userId,
      userEmail: registration.email,
    });
    return registration;
  }

  const payload = {
    program_key: programKey,
    user_id: userId,
    status: "draft" as const,
    first_name: draft.firstName ?? null,
    last_name: draft.lastName ?? null,
    email: draft.email ?? null,
    mobile_phone: draft.mobilePhone ?? null,
    street_address: draft.streetAddress ?? null,
    city: draft.city ?? null,
    state: draft.state ?? null,
    postal_code: draft.postalCode ?? null,
    church_name: draft.churchName ?? null,
    pastor_name: draft.pastorName ?? null,
    jurisdiction: draft.jurisdiction ?? null,
    amount_cents: draft.amountCents ?? null,
    currency: draft.currency || DEFAULT_REGISTRATION_CURRENCY,
    updated_by: actorUserId,
    created_by: actorUserId,
  };

  const { data, error } = await admin
    .from("registrations")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw mapDatabaseError(error);
  }

  const registration = mapRegistrationRow(data as RegistrationRow);
  await writeRegistrationAuditEvent({
    action: "registration.draft_created",
    registrationId: registration.id,
    userId,
    userEmail: registration.email,
  });
  return registration;
}

export async function submitRegistrationForUser(input: {
  userId: string;
  fields?: Partial<RegistrationSubmissionInput>;
}): Promise<Registration> {
  const userId = requireUserId(input.userId);
  const existing = await getActiveRegistrationForUser({ userId });

  if (!existing) {
    throw new RegistrationError(
      "not_found",
      "We could not find a registration draft to submit.",
    );
  }

  if (existing.status === "submitted") {
    // Idempotent submit — return the existing submitted registration.
    return existing;
  }

  if (!isRegistrationEditable(existing.status)) {
    throw new RegistrationError(
      "not_editable",
      "This registration can no longer be submitted.",
    );
  }

  const merged: RegistrationSubmissionInput = {
    firstName: input.fields?.firstName ?? existing.firstName ?? "",
    lastName: input.fields?.lastName ?? existing.lastName ?? "",
    email: input.fields?.email ?? existing.email ?? "",
    mobilePhone: input.fields?.mobilePhone ?? existing.mobilePhone ?? "",
    streetAddress: input.fields?.streetAddress ?? existing.streetAddress ?? "",
    city: input.fields?.city ?? existing.city ?? "",
    state: input.fields?.state ?? existing.state ?? "",
    postalCode: input.fields?.postalCode ?? existing.postalCode ?? "",
    churchName: input.fields?.churchName ?? existing.churchName ?? "",
    pastorName: input.fields?.pastorName ?? existing.pastorName ?? "",
    jurisdiction: input.fields?.jurisdiction ?? existing.jurisdiction ?? "",
    amountCents: existing.amountCents,
    currency: existing.currency,
  };

  let normalized: RegistrationSubmissionInput;
  try {
    normalized = assertRegistrationSubmission(merged);
  } catch (error) {
    throw new RegistrationError(
      "validation",
      error instanceof Error
        ? error.message
        : "Please complete all required fields before submitting.",
    );
  }

  const emailConflict = await getActiveRegistrationByEmail({
    email: normalized.email,
  });
  if (
    emailConflict &&
    emailConflict.id !== existing.id &&
    emailConflict.userId !== userId
  ) {
    throw new RegistrationError(
      "duplicate",
      "An active registration already exists for this email.",
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("registrations")
    .update({
      first_name: normalized.firstName,
      last_name: normalized.lastName,
      email: normalized.email,
      mobile_phone: normalized.mobilePhone,
      street_address: normalized.streetAddress,
      city: normalized.city,
      state: normalized.state,
      postal_code: normalized.postalCode,
      church_name: normalized.churchName,
      pastor_name: normalized.pastorName,
      jurisdiction: normalized.jurisdiction,
      status: "submitted",
      updated_by: userId,
    })
    .eq("id", existing.id)
    .eq("user_id", userId)
    .eq("status", "draft")
    .select("*")
    .single();

  if (error) {
    throw mapDatabaseError(error);
  }

  if (!data) {
    throw new RegistrationError(
      "conflict",
      "This registration was already submitted or can no longer be changed.",
    );
  }

  const registration = mapRegistrationRow(data as RegistrationRow);
  await writeRegistrationAuditEvent({
    action: "registration.submitted",
    registrationId: registration.id,
    userId,
    userEmail: registration.email,
    metadata: { status: registration.status },
  });

  return registration;
}
