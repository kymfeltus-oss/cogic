import { notFound } from "next/navigation";
import { isValidCredentialToken } from "@/lib/credentials/token";
import { resolveTicketToken } from "@/lib/tickets/repository";

export const dynamic = "force-dynamic";

type TicketProductEmbed = {
  name?: string | null;
  event_occurrences?: {
    local_date?: string | null;
    scheduled_start_at?: string | null;
    events?: { title?: string | null } | null;
  } | null;
};

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidCredentialToken(token)) notFound();
  const ticket = await resolveTicketToken(token);
  if (!ticket) {
    return (
      <main className="min-h-dvh bg-black p-8 text-center text-white">
        <h1>Ticket unavailable</h1>
        <p>This ticket is invalid, revoked, used, expired, or unavailable.</p>
      </main>
    );
  }

  const product = ticket.ticket_products as TicketProductEmbed | null | undefined;
  const occurrence = product?.event_occurrences;
  const event = occurrence?.events;

  return (
    <main className="min-h-dvh bg-black p-8 text-center text-white">
      <h1 className="text-3xl font-bold">Valid Event Ticket</h1>
      <p className="mt-4 text-xl">{event?.title || product?.name}</p>
      <p>
        {occurrence?.local_date} {occurrence?.scheduled_start_at}
      </p>
      <p>{ticket.holder_name || "Unassigned holder"}</p>
      <strong className="mt-6 block text-green-400">VALID</strong>
    </main>
  );
}
