import { redirect } from "next/navigation";
import HousingExperience from "@/components/housing/HousingExperience";
import { isAttendeeAuthOpen } from "@/lib/auth/attendee-auth-open";
import { getUserFromSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!isAttendeeAuthOpen() && !(await getUserFromSession())) {
    redirect("/login?next=%2Fhousing");
  }

  return (
    <main className="min-h-dvh bg-black p-5 text-white">
      <div className="mx-auto max-w-5xl">
        <HousingExperience />
      </div>
    </main>
  );
}
