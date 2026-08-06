import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live | COGIC LIVE",
  description: "Redirects to the production-honest live broadcast experience.",
};

/**
 * Former mock POV preview — no longer serves fabricated viewers/chat.
 * Attendees use the real /live experience.
 */
export default function ViewerPovGoLivePreviewPage() {
  redirect("/live");
}
