import { NextResponse } from "next/server";
import { toPublicCountdownConfig } from "@/lib/live/countdown-config";
import { loadActiveCountdownConfig } from "@/lib/live/fetch-countdown-config";
import { loadShowSetupState } from "@/lib/owner/show-setup-state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await loadActiveCountdownConfig();
    const setup = await loadShowSetupState().catch(() => ({
      eventLocation: "New Orleans, LA",
      livestreamAvailability: "Available worldwide",
    }));

    return NextResponse.json({
      ...toPublicCountdownConfig(config),
      eventLocation: setup.eventLocation,
      livestreamAvailability: setup.livestreamAvailability,
    }, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[COUNTDOWN_PUBLIC_ERR]:", error);
    return NextResponse.json(
      { error: "Unable to load countdown configuration." },
      { status: 500 },
    );
  }
}
