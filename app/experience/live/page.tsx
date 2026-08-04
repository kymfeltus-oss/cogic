import { redirect } from "next/navigation";
import { experienceLivePathFromRecord } from "@/lib/experience/live-routes";

type ExperienceLiveLegacyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy live URL — attendee experience lives at `/live`. */
export default async function ExperienceLiveLegacyPage({
  searchParams,
}: ExperienceLiveLegacyPageProps) {
  const params = await searchParams;
  redirect(experienceLivePathFromRecord(params));
}
