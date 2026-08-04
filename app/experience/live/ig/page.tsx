import { redirect } from "next/navigation";
import { experienceLivePathFromRecord } from "@/lib/experience/live-routes";

type ExperienceLiveIgLegacyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy URL — attendee live experience is at `/live` only. */
export default async function ExperienceLiveIgLegacyPage({
  searchParams,
}: ExperienceLiveIgLegacyPageProps) {
  const params = await searchParams;
  redirect(experienceLivePathFromRecord(params));
}
