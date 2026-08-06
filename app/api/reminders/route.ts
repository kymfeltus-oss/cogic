import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import {
  cancelUserReminder,
  listUserReminders,
  upsertUserReminder,
} from "@/lib/reminders/repository";
import { isReminderOffsetMinutes } from "@/lib/reminders/types";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const reminders = await listUserReminders(user.id);
  return NextResponse.json(
    { reminders },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const occurrenceId =
    typeof body?.occurrenceId === "string" ? body.occurrenceId.trim() : "";
  const offsetRaw = body?.offsetMinutes;

  if (!UUID.test(occurrenceId)) {
    return NextResponse.json({ error: "Valid occurrenceId is required." }, { status: 400 });
  }
  if (!isReminderOffsetMinutes(offsetRaw)) {
    return NextResponse.json(
      { error: "offsetMinutes must be 0, 15, or 30." },
      { status: 400 },
    );
  }

  try {
    const reminder = await upsertUserReminder({
      userId: user.id,
      occurrenceId,
      offsetMinutes: offsetRaw,
    });
    return NextResponse.json(
      { reminder },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save reminder." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  // Change reminder = upsert with new offset.
  return POST(request);
}

export async function DELETE(request: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const occurrenceId =
    typeof body?.occurrenceId === "string" ? body.occurrenceId.trim() : "";
  if (!UUID.test(occurrenceId)) {
    return NextResponse.json({ error: "Valid occurrenceId is required." }, { status: 400 });
  }

  try {
    const canceled = await cancelUserReminder({
      userId: user.id,
      occurrenceId,
    });
    return NextResponse.json(
      { canceled },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to cancel reminder." },
      { status: 400 },
    );
  }
}
