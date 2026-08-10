import "server-only";

import { loadTicketStore } from "@/lib/tickets/repository";
import { summarizeTickets, type DashboardTicketsSummary } from "@/lib/dashboard/dashboard-module-summaries";

type TicketInstance = {
  id?: string;
  status?: string;
  ticket_products?:
    | {
        name?: string | null;
        event_occurrences?:
          | {
              local_date?: string | null;
              scheduled_start_at?: string | null;
              events?: { title?: string | null } | Array<{ title?: string | null }> | null;
            }
          | Array<{
              local_date?: string | null;
              scheduled_start_at?: string | null;
              events?: { title?: string | null } | Array<{ title?: string | null }> | null;
            }>
          | null;
      }
    | Array<{
        name?: string | null;
        event_occurrences?: unknown;
      }>
    | null;
};

function eventTitle(product: TicketInstance["ticket_products"]): string | null {
  const row = Array.isArray(product) ? product[0] : product;
  if (!row) return row?.name ?? null;
  const occurrence = Array.isArray(row.event_occurrences)
    ? row.event_occurrences[0]
    : row.event_occurrences;
  const event = occurrence?.events;
  const eventRow = Array.isArray(event) ? event[0] : event;
  return eventRow?.title ?? row.name ?? null;
}

function startAt(product: TicketInstance["ticket_products"]): string | null {
  const row = Array.isArray(product) ? product[0] : product;
  const occurrence = Array.isArray(row?.event_occurrences)
    ? row?.event_occurrences[0]
    : row?.event_occurrences;
  return occurrence?.scheduled_start_at ?? occurrence?.local_date ?? null;
}

export async function loadDashboardTicketsSummary(
  userId: string | null,
): Promise<DashboardTicketsSummary> {
  if (!userId) {
    return {
      available: true,
      error: null,
      validCount: 0,
      revokedCount: 0,
      summary: "Sign in to view your tickets.",
      cta: "Sign in",
    };
  }

  try {
    const store = await loadTicketStore(userId);
    const instances: TicketInstance[] = [];
    for (const order of store.orders as Array<{ commerce_order_lines?: Array<{ ticket_instances?: TicketInstance | TicketInstance[] | null }> }>) {
      for (const line of order.commerce_order_lines ?? []) {
        const tickets = line.ticket_instances;
        if (!tickets) continue;
        if (Array.isArray(tickets)) instances.push(...tickets);
        else instances.push(tickets);
      }
    }

    const valid = instances.filter((ticket) => ticket.status === "valid");
    const revoked = instances.filter((ticket) => ticket.status === "revoked");
    const nearest = [...valid].sort((a, b) => {
      const aAt = startAt(a.ticket_products) ?? "";
      const bAt = startAt(b.ticket_products) ?? "";
      return aAt.localeCompare(bAt);
    })[0];

    return summarizeTickets({
      validCount: valid.length,
      revokedCount: revoked.length,
      nearestTitle: nearest ? eventTitle(nearest.ticket_products) : null,
    });
  } catch {
    return summarizeTickets({
      error: "Unable to load tickets.",
      validCount: 0,
      revokedCount: 0,
    });
  }
}
