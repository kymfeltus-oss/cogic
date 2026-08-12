"use client";

import { useEffect, useState } from "react";
import { GroupBookingRequestClient } from "@/components/travel/GroupBookingRequestClient";
import { TaxExemptUploadClient } from "./TaxExemptUploadClient";
import { TravelListSkeleton } from "@/components/travel/TravelLoadingSkeleton";

type GroupRequest = {
  id: string;
  party_size: number;
  travel_type: string;
  destination: string;
  departure_date: string;
  return_date: string;
  status: string;
  allocated_quote_cents: number | null;
  created_at: string;
};

type OrgGate = {
  role: string | null;
  churchId: string | null;
  churchName: string | null;
  canCreate: boolean;
};

export default function TravelGroupRequestsClient() {
  const [requests, setRequests] = useState<GroupRequest[]>([]);
  const [gate, setGate] = useState<OrgGate>({
    role: null,
    churchId: null,
    churchName: null,
    canCreate: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [listRes, meRes] = await Promise.all([
        fetch("/api/travel/group-requests", { cache: "no-store" }),
        fetch("/api/org/me", { cache: "no-store" }),
      ]);

      if (listRes.status === 401) {
        setError("Sign in to view church group travel requests.");
        setRequests([]);
        setGate({ role: null, churchId: null, churchName: null, canCreate: false });
        return;
      }
      if (!listRes.ok) {
        throw new Error("Unable to load group requests.");
      }

      const listJson = (await listRes.json()) as GroupRequest[];
      setRequests(Array.isArray(listJson) ? listJson : []);

      if (meRes.ok) {
        const me = (await meRes.json()) as {
          role?: string;
          churchId?: string | null;
          churchName?: string | null;
          canCreateGroupRequest?: boolean;
        };
        setGate({
          role: me.role ?? null,
          churchId: me.churchId ?? null,
          churchName: me.churchName ?? null,
          canCreate: Boolean(me.canCreateGroupRequest),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load group requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="grid gap-8">
      {error ? (
        <p className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-100">{error}</p>
      ) : null}

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold text-white">Your church requests</h2>
        {!gate.churchId && !loading ? (
          <p className="text-white/65">
            No church affiliation is linked to this account. Requests appear here after a Pastor or
            Overseer membership is assigned.
          </p>
        ) : loading ? (
          <TravelListSkeleton rows={3} />
        ) : requests.length === 0 ? (
          <p className="text-white/65">
            No group travel requests yet for {gate.churchName || "your church"}.
          </p>
        ) : (
          <ul className="grid gap-3">
            {requests.map((row) => (
              <li key={row.id} className="border-b border-white/10 pb-3 text-white/85">
                <p className="font-medium">
                  {row.destination} · {row.travel_type} · party of {row.party_size}
                </p>
                <p className="text-sm text-white/55">
                  {row.departure_date} → {row.return_date} · {row.status}
                  {row.allocated_quote_cents != null
                    ? ` · $${(row.allocated_quote_cents / 100).toFixed(2)}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {gate.canCreate ? (
        <section className="grid gap-4">
          <TaxExemptUploadClient
            churchId={gate.churchId}
            churchName={gate.churchName}
          />
        </section>
      ) : null}

      {gate.canCreate ? (
        <section className="grid gap-4">
          {showForm ? (
            <GroupBookingRequestClient
              churchName={gate.churchName || "your church"}
              onCancel={() => setShowForm(false)}
              onSubmitted={async () => {
                await load();
              }}
            />
          ) : (
            <>
              <p className="text-white/65">
                Pastors and Overseers can open a corporate quote request for parties of 10 or more.
                Church and requester identity are applied on the server.
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="inline-flex min-h-12 max-w-xs items-center justify-center rounded-xl bg-white px-5 font-semibold text-black"
              >
                Start group request
              </button>
            </>
          )}
        </section>
      ) : gate.churchId ? (
        <p className="text-white/65">
          Viewing as {gate.role || "Traveler"}. Only Pastor or Overseer roles can submit new group
          requests.
        </p>
      ) : null}
    </div>
  );
}
