import { NextResponse } from "next/server";

import { parseAccessContext } from "@/lib/access";
import { getUserFromSession } from "@/lib/auth/session";
import {
  acceptPolicy,
  loadOrMigrateRegistrationExperience,
  removeGroupRegistrant,
  saveRegistrant,
  submitGroup,
} from "@/lib/registration/slice2-repository";

export const dynamic = "force-dynamic";

async function currentAttendee() {
  const user = await getUserFromSession();
  if (!user?.id || parseAccessContext(user).isGuest) {
    return null;
  }
  return user;
}

export async function GET() {
  const user = await currentAttendee();
  if (!user) {
    return NextResponse.json({ error: "Create an attendee account to continue registration." }, { status: 401 });
  }
  return NextResponse.json(await loadOrMigrateRegistrationExperience(user.id), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const user = await currentAttendee();
  if (!user) {
    return NextResponse.json({ error: "Create an attendee account to continue registration." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  try {
    if (body?.action === "save_registrant") {
      return NextResponse.json({ registrant: await saveRegistrant(user.id, body.registrant) });
    }
    if (body?.action === "accept_policy") {
      await acceptPolicy(user.id, body);
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "submit_group") {
      return NextResponse.json(await submitGroup(user.id));
    }
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save registration." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove registrant." },
      { status: 400 },
    );
  }
}
