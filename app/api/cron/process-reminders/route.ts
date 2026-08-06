import { NextResponse } from "next/server";
import { processDueScheduleReminders } from "@/lib/reminders/process";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  return header === `Bearer ${secret}`;
}

/** Vercel Cron entrypoint — batch process due schedule reminders. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await processDueScheduleReminders();
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error(
      "[cron/process-reminders] failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "Unable to process reminders." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
