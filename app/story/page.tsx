import { redirect } from "next/navigation";

/** Legacy story CTA — canonical intro video lives at `/`. */
export default function StoryPage() {
  redirect("/");
}
