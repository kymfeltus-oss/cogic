import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** RETIRED — client recheck. Use My Trip resume or owner sync_supplier_status after paid booking. */
function gone() {
  return NextResponse.json(
    {
      error:
        "Marketplace recheck is retired. Open My Trip to continue secure checkout, or ask an owner to sync supplier status after a paid booking.",
      code: "recheck_retired",
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
