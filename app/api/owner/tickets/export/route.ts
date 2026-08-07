import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const { data, error } = await getSupabaseAdmin()
    .from("ticket_instances")
    .select("id,holder_name,status,complimentary,issued_at,used_at,ticket_products(name,event_occurrences(local_date,events(title)))")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return NextResponse.json({ error: "Unable to export ticket holders." }, { status: 500 });
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [
    ["Ticket ID", "Holder", "Product", "Event", "Event Date", "Status", "Complimentary", "Issued", "Used"],
    ...(data ?? []).map((ticket: any) => [ticket.id, ticket.holder_name, ticket.ticket_products?.name, ticket.ticket_products?.event_occurrences?.events?.title, ticket.ticket_products?.event_occurrences?.local_date, ticket.status, ticket.complimentary, ticket.issued_at, ticket.used_at]),
  ];
  return new NextResponse(rows.map((row) => row.map(escape).join(",")).join("\n"), { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=ticket-holders.csv", "Cache-Control": "private, no-store" } });
}
