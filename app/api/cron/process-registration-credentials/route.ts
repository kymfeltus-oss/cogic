import { NextResponse } from "next/server";

import { processDueRegistrationCredentialJobs } from "@/lib/registration/process-credential-jobs";
import { assertSafeRegistrationEnvironment } from "@/lib/registration/runtime-mode";
import { redactForLog, safeErrorMessage } from "@/lib/security/redact";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const header = request.headers.get("authorization")?.trim() ?? "";
  return header === `Bearer ${secret}`;
}

/**
 * Vercel Cron entrypoint — claim and process due registration credential jobs.
 * Payment confirmation is never rolled back from this worker.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    assertSafeRegistrationEnvironment();
    const result = await processDueRegistrationCredentialJobs(25);
    return NextResponse.json(
      {
        ok: true,
        claimed: result.claimed,
        processed: result.processed,
        completed: result.completed,
        retried: result.retried,
        dead: result.dead,
        failed: result.failed,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error(
      "[cron/process-registration-credentials] failed:",
      redactForLog(safeErrorMessage(error)),
    );
    return NextResponse.json(
      { error: "Unable to process registration credential jobs." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
