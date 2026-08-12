"use client";

import { FormEvent, useEffect, useState } from "react";
import { TravelTableSkeleton } from "@/components/travel/TravelLoadingSkeleton";

type RequestStatus =
  | "pending_quote"
  | "quoted"
  | "approved"
  | "rejected"
  | "canceled"
  | "fulfilled";

type RequestItem = {
  id: string;
  church_id: string;
  party_size: number;
  travel_type: string;
  destination: string;
  departure_date: string;
  return_date: string;
  status: RequestStatus | string;
  allocated_quote_cents: number | null;
  internal_notes: string | null;
  owner_notes: string | null;
};

const STATUSES: RequestStatus[] = [
  "pending_quote",
  "quoted",
  "approved",
  "rejected",
  "canceled",
  "fulfilled",
];

function money(cents: number | null | undefined) {
  if (cents == null) return "Unassigned";
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Owner console for corporate group booking requests.
 * Loads from /api/owner/travel/group-requests (owner auth), not the church-scoped leader route.
 */
export default function TravelGroupRequestsClient() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/travel/group-requests", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        requests?: RequestItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "Unable to load group requests.");
      }
      setRequests(Array.isArray(json.requests) ? json.requests : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load group requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleUpdate(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setBusyId(id);
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") ?? "").trim();
    const ownerNotes = String(form.get("ownerNotes") ?? "").trim();
    const dollarsRaw = String(form.get("quoteDollars") ?? "").trim();
    const payload: Record<string, unknown> = {
      requestId: id,
      status,
      ownerNotes: ownerNotes || null,
    };

    if (dollarsRaw !== "") {
      const dollars = Number(dollarsRaw);
      if (!Number.isFinite(dollars) || dollars < 0) {
        setError("Quote must be a non-negative dollar amount.");
        setBusyId(null);
        return;
      }
      payload.allocated_quote_cents = Math.round(dollars * 100);
    }

    try {
      const response = await fetch("/api/owner/travel/group-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json().catch(() => ({}))) as {
        request?: RequestItem;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error || "Update failed.");
      }
      if (json.request) {
        setRequests((prev) => prev.map((row) => (row.id === id ? { ...row, ...json.request! } : row)));
      } else {
        await load();
      }
      setNotice("Group request updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-[#d8ab2e]/40 bg-[#0d1020] p-5">
        <p className="font-black tracking-[.15em] text-[#d8ab2e]">GROUP REQUESTS</p>
        <h2 className="mt-2 text-2xl font-bold">Corporate church quotes</h2>
        <TravelTableSkeleton columns={6} rows={4} />
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#d8ab2e]/40 bg-[#0d1020] p-5">
      <p className="font-black tracking-[.15em] text-[#d8ab2e]">GROUP REQUESTS</p>
      <h2 className="mt-2 text-2xl font-bold">Corporate church quotes</h2>
      <p className="mt-2 text-white/65">
        Live rows from <code>travel_group_booking_requests</code>. Quote amounts are owner-entered
        only — never invented client-side. Leaders submit via <code>/travel/group</code>.
      </p>

      {error ? (
        <p className="mt-3 rounded border border-red-400/40 bg-red-400/10 p-3 text-red-200">{error}</p>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded border border-emerald-400/40 bg-emerald-400/10 p-3 text-emerald-100">
          {notice}
        </p>
      ) : null}

      {requests.length === 0 ? (
        <p className="mt-4 text-center text-sm text-white/55">
          No outstanding corporate group bookings.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead className="border-b border-white/15 text-xs uppercase tracking-wider text-white/55">
              <tr>
                <th className="p-3">Destination</th>
                <th className="p-3">Size</th>
                <th className="p-3">Type</th>
                <th className="p-3">Dates</th>
                <th className="p-3">Status / quote</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/80">
              {requests.map((req) => (
                <tr key={req.id}>
                  <td className="p-3 align-top">
                    <p className="font-medium text-white">{req.destination}</p>
                    <p className="text-xs text-white/45">church {req.church_id.slice(0, 8)}…</p>
                    {req.internal_notes ? (
                      <p className="mt-1 text-xs text-white/50">{req.internal_notes}</p>
                    ) : null}
                  </td>
                  <td className="p-3 align-top">{req.party_size}</td>
                  <td className="p-3 align-top capitalize">{req.travel_type}</td>
                  <td className="p-3 align-top text-xs">
                    {req.departure_date} → {req.return_date}
                  </td>
                  <td className="p-3 align-top">
                    <p className="text-xs font-medium text-[#d8ab2e]">{req.status}</p>
                    <p className="font-mono text-xs">{money(req.allocated_quote_cents)}</p>
                  </td>
                  <td className="p-3 align-top">
                    <form
                      className="ml-auto grid max-w-sm gap-2"
                      onSubmit={(event) => void handleUpdate(event, req.id)}
                    >
                      <select
                        name="status"
                        defaultValue={req.status}
                        className="min-h-10 rounded border border-white/15 bg-black/40 px-2 text-white"
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <input
                        name="quoteDollars"
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={
                          req.allocated_quote_cents != null
                            ? (req.allocated_quote_cents / 100).toFixed(2)
                            : ""
                        }
                        placeholder="Quote USD"
                        className="min-h-10 rounded border border-white/15 bg-black/40 px-2 text-white"
                      />
                      <input
                        name="ownerNotes"
                        defaultValue={req.owner_notes ?? ""}
                        placeholder="Owner notes"
                        className="min-h-10 rounded border border-white/15 bg-black/40 px-2 text-white"
                      />
                      <button
                        type="submit"
                        disabled={busyId === req.id}
                        className="min-h-10 rounded bg-white px-3 text-xs font-semibold text-black disabled:opacity-60"
                      >
                        {busyId === req.id ? "Saving…" : "Save quote / status"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
