import { NextResponse } from "next/server";

import { parseAccessContext } from "@/lib/access";
import { getUserFromSession } from "@/lib/auth/session";
import { registrationHttpStatus, toSafeRegistrationMessage } from "@/lib/registration/errors";
import { assertSafeRegistrationEnvironment } from "@/lib/registration/runtime-mode";
import {
  acceptPolicy,
  loadOrMigrateRegistrationExperience,
  removeGroupRegistrant,
  savePrimaryRegistrationDraft,
  saveRegistrant,
  submitGroup,
} from "@/lib/registration/slice2-repository";
import {
  sanitizeRegistrationPrimaryDraftInput,
  type RegistrationVersionContract,
} from "@/lib/registration/types";

export const dynamic = "force-dynamic";

function guardRegistrationRuntime(): NextResponse | null {
  try {
    assertSafeRegistrationEnvironment();
    return null;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "CRITICAL MISCONFIGURATION: USE_MOCK_REGISTRATION cannot be enabled in a production environment.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

async function currentAttendee() {
  const user = await getUserFromSession();
  if (!user?.id || parseAccessContext(user).isGuest) {
    return null;
  }
  return user;
}

function readVersionContract(body: Record<string, unknown> | null): RegistrationVersionContract {
  const versions =
    body?.versions && typeof body.versions === "object" && !Array.isArray(body.versions)
      ? (body.versions as Record<string, unknown>)
      : {};

  return {
    groupVersion: typeof versions.groupVersion === "number" ? versions.groupVersion : null,
    registrationVersion:
      typeof versions.registrationVersion === "number" ? versions.registrationVersion : null,
  };
}

function readPrimaryDraftSource(body: Record<string, unknown> | null): unknown {
  if (!body) return {};
  if (body.draft && typeof body.draft === "object" && !Array.isArray(body.draft)) {
    return body.draft;
  }
  if (body.registrant && typeof body.registrant === "object" && !Array.isArray(body.registrant)) {
    return body.registrant;
  }
  return {};
}

export async function GET() {
  const runtimeGuard = guardRegistrationRuntime();
  if (runtimeGuard) return runtimeGuard;
  const user = await currentAttendee();
  if (!user) {
    return NextResponse.json({ error: "Create an attendee account to continue registration." }, { status: 401 });
  }
  return NextResponse.json(await loadOrMigrateRegistrationExperience(user.id), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const runtimeGuard = guardRegistrationRuntime();
  if (runtimeGuard) return runtimeGuard;
  const user = await currentAttendee();
  if (!user) {
    return NextResponse.json({ error: "Create an attendee account to continue registration." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    if (body?.action === "save_primary_draft") {
      const draft = sanitizeRegistrationPrimaryDraftInput(readPrimaryDraftSource(body));
      const result = await savePrimaryRegistrationDraft(user.id, draft, readVersionContract(body));
      return NextResponse.json({ draft: result, experience: await loadOrMigrateRegistrationExperience(user.id) });
    }
    if (body?.action === "save_registrant") {
      const registrant = await saveRegistrant(user.id, body.registrant as never);
      return NextResponse.json({ registrant, experience: await loadOrMigrateRegistrationExperience(user.id) });
    }
    if (body?.action === "accept_policy") {
      await acceptPolicy(user.id, body as never);
      return NextResponse.json({ ok: true, experience: await loadOrMigrateRegistrationExperience(user.id) });
    }
    if (body?.action === "submit_group") {
      return NextResponse.json(await submitGroup(user.id));
    }
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: toSafeRegistrationMessage(error) }, { status: registrationHttpStatus(error) });
  }
}

export async function DELETE(request: Request) {
  const runtimeGuard = guardRegistrationRuntime();
  if (runtimeGuard) return runtimeGuard;
  const user = await currentAttendee();
  if (!user) {
    return NextResponse.json({ error: "Create an attendee account to continue registration." }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json({ error: "Registrant ID required." }, { status: 400 });
  }
  try {
    await removeGroupRegistrant(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: toSafeRegistrationMessage(error) }, { status: registrationHttpStatus(error) });
  }
}
