import { redirect } from "next/navigation";

/** Legacy My Convocation travel entry — My Trip is the live itinerary surface. */
export default function LegacyTravelRedirect() {
  redirect("/travel/trip");
}
