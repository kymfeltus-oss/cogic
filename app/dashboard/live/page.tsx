import { redirect } from "next/navigation";
import { experienceLivePathFromRecord } from "@/lib/experience/live-routes";

type DashboardLivePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy attendee live entry — forwards to `/live`. */
export default async function LiveRoomPage({ searchParams }: DashboardLivePageProps) {
  const params = await searchParams;
  redirect(experienceLivePathFromRecord(params));
}
