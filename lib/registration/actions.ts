"use server";

import { parseAccessContext } from "@/lib/access";
import { getUserFromSession } from "@/lib/auth/session";
import { parseNameFieldsFromMetadata } from "@/lib/experience/user-profile-display";
import {
  RegistrationError,
  toSafeRegistrationMessage,
} from "@/lib/registration/errors";
import {
  getActiveRegistrationForUser,
  submitRegistrationForUser,
  upsertRegistrationDraft,
} from "@/lib/registration/repository";
import type { Registration, RegistrationDraftInput } from "@/lib/registration/types";
import { DEFAULT_PROGRAM_KEY } from "@/lib/registration/types";
import {
  pickDraftEditableFields,
  resolveRegistrationViewMode,
  type RegistrationViewMode,
} from "@/lib/registration/workflow";

export type RegistrationActionResult =
  | {
      ok: true;
      registration: Registration;
      viewMode: RegistrationViewMode;
    }
  | {
      ok: false;
      code: string;
      message: string;
      fieldIssues?: { field: string; message: string }[];
    };

async function requireRegistrantUser() {
  const user = await getUserFromSession();
  if (!user) {
    throw new RegistrationError(
      "auth_required",
      "Please sign in to continue registration.",
    );
  }

  const access = parseAccessContext(user);
  if (access.isGuest) {
    throw new RegistrationError(
      "guest_not_allowed",
      "Please create a full account before registering for Convocation.",
    );
  }

  return user;
}

function toResult(registration: Registration): Extract<RegistrationActionResult, { ok: true }> {
  return {
    ok: true,
    registration,
    viewMode: resolveRegistrationViewMode(registration),
  };
}

function fail(error: unknown): Extract<RegistrationActionResult, { ok: false }> {
  if (error instanceof RegistrationError) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      fieldIssues: error.fieldIssues,
    };
  }

  console.error("[REGISTRATION_ACTION_ERR]:", error);
  return {
    ok: false,
    code: "unknown",
    message: toSafeRegistrationMessage(error),
  };
}

function draftPrefillFromUser(user: Awaited<ReturnType<typeof requireRegistrantUser>>): RegistrationDraftInput {
  const names = parseNameFieldsFromMetadata(user.user_metadata);
  const phone =
    typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : null;
  const city =
    typeof user.user_metadata?.city === "string" ? user.user_metadata.city : null;
  const state =
    typeof user.user_metadata?.state === "string" ? user.user_metadata.state : null;

  return {
    firstName: names.firstName || null,
    lastName: names.lastName || null,
    email: user.email?.trim().toLowerCase() || null,
    mobilePhone: phone,
    city,
    state,
  };
}

/**
 * Create or resume the caller's draft. Ignores client user_id / program_key.
 */
export async function createOrResumeRegistrationDraft(): Promise<RegistrationActionResult> {
  try {
    const user = await requireRegistrantUser();
    const existing = await getActiveRegistrationForUser({ userId: user.id });

    if (existing) {
      if (existing.status !== "draft") {
        return toResult(existing);
      }
      return toResult(existing);
    }

    const registration = await upsertRegistrationDraft({
      userId: user.id,
      draft: draftPrefillFromUser(user),
    });

    return toResult(registration);
  } catch (error) {
    return fail(error);
  }
}

/**
 * Persist draft field updates. Server resolves identity and program_key.
 */
export async function updateRegistrationDraft(
  fields: Record<string, unknown>,
): Promise<RegistrationActionResult> {
  try {
    const user = await requireRegistrantUser();
    const editable = pickDraftEditableFields(fields);

    // Reject privileged identity fields if a client tried to smuggle them.
    if ("userId" in fields || "user_id" in fields || "programKey" in fields || "program_key" in fields) {
      // Ignore silently for identity — never apply client values.
    }
    if ("status" in fields) {
      throw new RegistrationError(
        "forbidden",
        "Registration status cannot be changed from the form.",
      );
    }

    const registration = await upsertRegistrationDraft({
      userId: user.id,
      draft: {
        ...editable,
        // program_key intentionally omitted — repository forces DEFAULT_PROGRAM_KEY
      },
    });

    if (registration.programKey !== DEFAULT_PROGRAM_KEY) {
      throw new RegistrationError(
        "conflict",
        "Registration program mismatch. Please contact support.",
      );
    }

    if (registration.userId !== user.id) {
      throw new RegistrationError(
        "forbidden",
        "You do not have access to this registration.",
      );
    }

    return toResult(registration);
  } catch (error) {
    return fail(error);
  }
}

/**
 * Submit draft → submitted only. Does not confirm or start payment.
 * Optional fields are saved to the draft first; empty values do not wipe stored data.
 */
export async function submitRegistration(
  fields?: Record<string, unknown>,
): Promise<RegistrationActionResult> {
  try {
    const user = await requireRegistrantUser();

    if (fields) {
      const editable = pickDraftEditableFields(fields);
      if (Object.keys(editable).length > 0) {
        await upsertRegistrationDraft({
          userId: user.id,
          draft: editable,
        });
      }
    }

    const registration = await submitRegistrationForUser({
      userId: user.id,
    });

    if (registration.userId !== user.id) {
      throw new RegistrationError(
        "forbidden",
        "You do not have access to this registration.",
      );
    }

    if (registration.status !== "submitted") {
      throw new RegistrationError(
        "conflict",
        "Registration could not be submitted at this time.",
      );
    }

    return toResult(registration);
  } catch (error) {
    return fail(error);
  }
}

export async function loadRegistrationForCurrentUser(): Promise<RegistrationActionResult> {
  try {
    const user = await requireRegistrantUser();
    const existing = await getActiveRegistrationForUser({ userId: user.id });
    if (!existing) {
      return createOrResumeRegistrationDraft();
    }
    return toResult(existing);
  } catch (error) {
    return fail(error);
  }
}
