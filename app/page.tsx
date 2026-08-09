import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** App entry — COGIC LIVE intro plate with Enter routing. */
export default function HomePage() {
  redirect("/intro");
}
