import { redirect } from "next/navigation";
import { PUBLIC_COUNTDOWN_PATH } from "@/lib/experience/live-routes";

type DashboardCountdownPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function countdownPathFromRecord(
  params: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, entry);
      }
      continue;
    }
    query.set(key, value);
  }

  const queryString = query.toString();
  return queryString ? `${PUBLIC_COUNTDOWN_PATH}?${queryString}` : PUBLIC_COUNTDOWN_PATH;
}

/** Legacy attendee countdown entry — forwards to `/countdown`. */
export default async function DashboardCountdownPage({
  searchParams,
}: DashboardCountdownPageProps) {
  const params = await searchParams;
  redirect(countdownPathFromRecord(params));
}
