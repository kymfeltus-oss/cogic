import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedBuyer } from "@/lib/checkout/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type ChatRequestBody = {
  content?: string;
};

const MAX_CONTENT_LENGTH = 500;

export async function POST(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedBuyer(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required to post in live chat." },
        { status: 401 },
      );
    }

    const { buyer, withSessionCookies } = auth;

    const body = (await request.json()) as ChatRequestBody;
    const content = body.content?.trim();

    if (!content || content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Message must be between 1 and ${MAX_CONTENT_LENGTH} characters.` },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        user_id: buyer.userId,
        email: buyer.email,
        content,
      })
      .select("id, user_id, email, content, created_at")
      .single();

    if (error || !data) {
      console.error("Failed to persist chat message:", error?.message);
      return NextResponse.json(
        { error: "Unable to save chat message." },
        { status: 500 },
      );
    }

    return withSessionCookies(NextResponse.json({ message: data }));
  } catch (error) {
    console.error("Live chat route error:", error);
    return NextResponse.json(
      { error: "Unable to send message." },
      { status: 500 },
    );
  }
}
