import { redirect } from "next/navigation";

/** Legacy experience path — canonical COGIC Giving is `/giving`. */
export default function ExperienceGivingPage() {
  redirect("/giving");
}
