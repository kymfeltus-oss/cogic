import { redirect } from "next/navigation";
import { experienceLivePathFromRecord } from "@/lib/experience/live-routes";

type ExperienceHoldingRoomPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy holding room URL — pre-live waiting now lives on `/live`. */
export default async function ExperienceHoldingRoomPage({
  searchParams,
}: ExperienceHoldingRoomPageProps) {
  const params = await searchParams;
  redirect(experienceLivePathFromRecord(params));
}
