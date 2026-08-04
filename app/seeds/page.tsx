import { redirect } from "next/navigation";

type SeedsPageProps = {
  searchParams: Promise<{ streamId?: string }>;
};

/** Seed hub — forwards to buy-seeds with optional stream context. */
export default async function SeedsPage({ searchParams }: SeedsPageProps) {
  const params = await searchParams;
  const streamId = params.streamId?.trim();
  const query = streamId ? `?streamId=${encodeURIComponent(streamId)}` : "";
  redirect(`/buy-seeds${query}`);
}
