import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { listUserSupplierChangeEvents } from "@/lib/travel/ops/supplier-events";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUserFromSession();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    const events = await listUserSupplierChangeEvents(user.id);
    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load supplier updates." },
      { status: 500 },
    );
  }
}
