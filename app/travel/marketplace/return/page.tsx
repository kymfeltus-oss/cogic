import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type MarketplaceReturnPageProps = {
  searchParams: Promise<{
    attemptId?: string;
    attempt_id?: string;
  }>;
};

/**
 * Legacy partner-return landing. Partner handoff APIs are deleted.
 * Soft-land attendees into the live in-app Elements checkout path.
 */
export default async function MarketplaceReturnPage({ searchParams }: MarketplaceReturnPageProps) {
  const params = await searchParams;
  const attemptId = String(params.attemptId || params.attempt_id || "").trim();
  if (attemptId) {
    redirect(`/travel/checkout/continue?attemptId=${encodeURIComponent(attemptId)}`);
  }
  redirect("/travel");
}
