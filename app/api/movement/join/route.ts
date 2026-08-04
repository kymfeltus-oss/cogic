import { NextResponse } from "next/server";
import { isValidEmail, isValidPhone, normalizePhoneDigits } from "@/lib/auth/validation";
import { normalizeProfileName } from "@/lib/profile/persist-attendee-profile";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type JoinMovementBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as JoinMovementBody;
    const firstName = normalizeProfileName(body.firstName ?? "");
    const lastName = normalizeProfileName(body.lastName ?? "");
    const email = body.email?.trim().toLowerCase() ?? "";
    const phone = normalizePhoneDigits(body.phone ?? "");

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First and last name are required." },
        { status: 400 },
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json(
        { error: "Valid 10-digit phone number is required." },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from("movement_leads").upsert(
      {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        source: "join_movement_page",
      },
      { onConflict: "email" },
    );

    if (error) {
      console.error("[movement/join] upsert failed:", error.message);
      return NextResponse.json(
        { error: "Unable to save your information right now." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[movement/join] unexpected error:", error);
    return NextResponse.json(
      { error: "Unable to process your request." },
      { status: 500 },
    );
  }
}
