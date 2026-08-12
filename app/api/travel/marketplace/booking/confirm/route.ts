import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** RETIRED — typed confirmation. Use paid in-app checkout → supplier book → ledger CONFIRMED. */
function gone() {
  return NextResponse.json(
    {
      error:
        "Manual marketplace confirmation is retired. Complete payment in secure in-app checkout so the supplier confirmation is captured automatically.",
      code: "manual_confirm_retired",
      checkoutPath: "/travel",
      tripPath: "/travel/trip",
    },
    { status: 410 },
  );
}

export async function GET() {
  return gone();
}

export async function POST() {
  return gone();
}

export async function PUT() {
  return gone();
}

export async function PATCH() {
  return gone();
}
