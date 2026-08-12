import { NextRequest, NextResponse } from "next/server";

import { createRegistrationCheckoutSession } from "@/lib/registration/checkout";

export async function POST(request: NextRequest) {
  const result = await createRegistrationCheckoutSession(request);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      {
        status: result.status,
        headers: "headers" in result ? result.headers : undefined,
      },
    );
  }

  return result.withSessionCookies(NextResponse.json({
    url: result.url,
    sandboxSession: "sandboxSession" in result ? result.sandboxSession : undefined,
  }));
}

