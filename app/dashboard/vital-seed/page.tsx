import { redirect } from "next/navigation";

/** Legacy Vital Seed path — canonical COGIC Giving is `/giving`. */
export default function VitalSeedPage() {
  redirect("/giving");
}
