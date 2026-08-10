import { NextResponse } from "next/server";
import { marketplaceStatus } from "@/lib/travel/marketplace/credentials";

export async function GET() {
  return NextResponse.json(marketplaceStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
