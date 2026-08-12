"use client";

import { FormEvent, useEffect, useState } from "react";
import TravelGroupRequestsClient from "@/components/owner/TravelGroupRequestsClient";
import TravelTaxReviewClient from "@/components/owner/TravelTaxReviewClient";

const mask = (v: string | null) => (v ? `••••${v.slice(-4)}` : "—");
const input = "min-h-12 w-full rounded bg-white p-3 text-black";
const money = (cents: number | null | undefined) =>
  cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;

const LEDGER_STATUSES = [
  "FAILED",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "DRAFT",
  "SUPPLIER_SUBMITTED",
  "REFUNDED",
] as const;

export default function TravelManagementClient() {
  const [data, setData] = useState<any>({
    hotels: [],
    providers: [],
    marketplaceReadiness: {},
    reservations: [],
    airports: [],
    transport: [],
    announcements: [],
    marketplaceAttempts: [],
    bookingTransactions: [],
    transactionEvents: [],
    marketplaceQueues: {},
    marketplaceProviderExceptions: {},
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [q, setQ] = useState("");
  const [marketplaceProvider, setMarketplaceProvider] = useState("");
  const [marketplaceKind, setMarketplaceKind] = useState("");
  const [marketplaceStatus, setMarketplaceStatus] = useState("");
  const [marketplaceSort, setMarketplaceSort] = useState("started_at_desc");
  const [marketplaceDateFrom, setMarketplaceDateFrom] = useState("");
  const [marketplaceDateTo, setMarketplaceDateTo] = useState("");
  const [marketplaceStaleOnly, setMarketplaceStaleOnly] = useState(false);
  const [marketplaceUserId, setMarketplaceUserId] = useState("");
  const [amountMinDollars, setAmountMinDollars] = useState("");
  const [amountMaxDollars, setAmountMaxDollars] = useState("");
  const [refundReason, setRefundReason] = useState<Record<string, string>>({});
  const [overrideNote, setOverrideNote] = useState<Record<string, string>>({});
  const [overrideForm, setOverrideForm] = useState({
    transactionId: "",
    attemptId: "",
    note: "",
    eventName: "owner_internal_override",
  });
  const [filtersReady, setFiltersReady] = useState(false);

  async function load(
    overrides: { query?: string; status?: string; staleOnly?: boolean } = {},
  ) {
    const params = new URLSearchParams();
    const query = overrides.query ?? q;
    const status = overrides.status ?? marketplaceStatus;
    const staleOnly = overrides.staleOnly ?? marketplaceStaleOnly;
    if (query) params.set("q", query);
    if (marketplaceUserId.trim()) params.set("marketplaceUserId", marketplaceUserId.trim());
    if (marketplaceProvider) params.set("marketplaceProvider", marketplaceProvider);
    if (marketplaceKind) params.set("marketplaceKind", marketplaceKind);
    if (status) params.set("marketplaceStatus", status);
    if (marketplaceSort) params.set("marketplaceSort", marketplaceSort);
    if (marketplaceDateFrom) params.set("marketplaceDateFrom", marketplaceDateFrom);
    if (marketplaceDateTo) params.set("marketplaceDateTo", marketplaceDateTo);
    if (staleOnly) params.set("marketplaceStaleOnly", "1");
    const minDollars = Number(amountMinDollars);
    const maxDollars = Number(amountMaxDollars);
    if (amountMinDollars !== "" && Number.isFinite(minDollars)) {
      params.set("marketplaceAmountMinCents", String(Math.round(minDollars * 100)));
    }
    if (amountMaxDollars !== "" && Number.isFinite(maxDollars)) {
      params.set("marketplaceAmountMaxCents", String(Math.round(maxDollars * 100)));
    }
    const r = await fetch(`/api/owner/travel?${params}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
    else setError("Unable to load travel administration.");
  }

  useEffect(() => {
    void load().finally(() => setFiltersReady(true));
    // Initial owner travel load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    void load();
    // Auto-refresh ledger whenever structural filters change (LAW 10).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filtersReady,
    marketplaceProvider,
    marketplaceKind,
    marketplaceStatus,
    marketplaceSort,
    marketplaceDateFrom,
    marketplaceDateTo,
    marketplaceStaleOnly,
    marketplaceUserId,
    amountMinDollars,
    amountMaxDollars,
  ]);

  async function availability(id: number, status: string) {
    setError("");
    const r = await fetch("/api/owner/travel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "availability", id, status }),
    });
    if (!r.ok) setError((await r.json()).error || "Unable to update availability.");
    else await load();
  }

  async function reservation(id: string, action: "cancel") {
    setError("");
    const r = await fetch("/api/owner/travel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (!r.ok) setError((await r.json()).error);
    else await load();
  }

  async function createGuide(e: FormEvent<HTMLFormElement>, kind: string) {
    e.preventDefault();
    setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/owner/travel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        ...form,
        published: form.published === "on",
        displayOrder: Number(form.displayOrder || 0),
      }),
    });
    if (!r.ok) setError((await r.json()).error || "Unable to create.");
    else {
      e.currentTarget.reset();
      await load();
    }
  }

  async function togglePublish(
    kind: "airport" | "transport" | "announcement",
    id: string,
    published: boolean,
  ) {
    const r = await fetch("/api/owner/travel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, published: !published }),
    });
    if (!r.ok) setError((await r.json()).error || "Unable to update.");
    else await load();
  }

  async function runOps(action: string, payload: Record<string, unknown>) {
    setBusyAction(
      `${action}:${String(payload.attemptId || payload.transactionId || payload.roomTypeId || "form")}`,
    );
    setError("");
    setNotice("");
    const r = await fetch("/api/owner/travel/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const json = await r.json().catch(() => ({}));
    setBusyAction("");
    if (!r.ok) {
      setError(json.error || "Ops action failed.");
      return;
    }
    setNotice(
      action === "sync_supplier_status"
        ? `Supplier sync complete${json.canceled ? " — cancellation applied" : ""}.`
        : action === "refund_stripe"
          ? json.alreadyRefunded
            ? "Attempt already refunded."
            : `Stripe refund posted (${json.refundId}).`
          : action === "log_override"
            ? `Internal override logged to travel_booking_transaction_events (#${json.eventId}).`
            : `Updated ${json.nights || 0} inventory night(s).`,
    );
    await load();
  }

  async function submitOverrideForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runOps("log_override", {
      transactionId: overrideForm.transactionId || null,
      attemptId: overrideForm.attemptId || null,
      note: overrideForm.note,
      eventName: overrideForm.eventName || "owner_internal_override",
    });
    setOverrideForm((prev) => ({ ...prev, note: "" }));
  }

  async function submitInventoryDates(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    await runOps("inventory_dates", {
      roomTypeId: String(form.roomTypeId || ""),
      fromDate: String(form.fromDate || ""),
      toDate: String(form.toDate || ""),
      status: String(form.status || "UNAVAILABLE"),
      nightlyRateCents: form.nightlyRateCents ? Number(form.nightlyRateCents) * 100 : null,
    });
  }

  const queues = data.marketplaceQueues || {};

  return (
    <div className="mt-6 grid gap-6">
      {notice ? <p className="rounded border border-emerald-400/40 bg-emerald-400/10 p-3 text-emerald-100">{notice}</p> : null}
      {error ? <p className="rounded border border-red-400/40 bg-red-400/10 p-3 text-red-200">{error}</p> : null}

      <TravelTaxReviewClient />

      <TravelGroupRequestsClient />

      <section className="rounded-xl border border-[#d8ab2e]/40 bg-[#0d1020] p-5">
        <p className="font-black tracking-[.15em] text-[#d8ab2e]">TRANSACTIONAL LEDGER</p>
        <h2 className="mt-2 text-2xl font-bold">Live marketplace activity</h2>
        <p className="mt-2 text-white/65">
          Data-driven rows from <code>travel_marketplace_booking_attempts</code> and{" "}
          <code>travel_booking_transactions</code> only. Filter by user account id, Expedia/Duffel,
          checkout cents, and exact machine state. Partner webhooks at{" "}
          <code>/api/travel/webhooks/supplier</code> write <code>travel_booking_transaction_events</code>{" "}
          and surface on My Trip. Secrets never leave the server.
        </p>

        <div className="mt-4 grid gap-2 md:grid-cols-3 lg:grid-cols-7">
          {[
            ["draft", "DRAFT", queues.booking_started_unconfirmed],
            ["payment_pending", "PAYMENT_PENDING", queues.payment_pending],
            ["pending_confirmation", "SUPPLIER_SUBMITTED", queues.pending_confirmation],
            ["confirmed", "CONFIRMED", queues.confirmed],
            ["failed", "FAILED", queues.failed],
            ["refunded", "REFUNDED", queues.refunded],
            ["stale_pending_review", "Stale open", queues.stale_pending_review],
          ].map(([key, label, rows]) => (
            <button
              key={String(key)}
              type="button"
              className="rounded border border-white/10 p-3 text-left hover:border-[#d8ab2e]/50"
              onClick={() => {
                const next = String(label);
                if (LEDGER_STATUSES.includes(next as (typeof LEDGER_STATUSES)[number])) {
                  setMarketplaceStaleOnly(false);
                  setMarketplaceStatus(next);
                  void load({ status: next, staleOnly: false });
                  return;
                }
                if (next === "Stale open") {
                  setMarketplaceStatus("");
                  setMarketplaceStaleOnly(true);
                  void load({ status: "", staleOnly: true });
                  return;
                }
                void load();
              }}
            >
              <span className="block text-xs uppercase text-white/50">{label}</span>
              <strong className="text-2xl">{Array.isArray(rows) ? rows.length : 0}</strong>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3 lg:grid-cols-6">
          <input
            className={input}
            value={marketplaceUserId}
            onChange={(e) => setMarketplaceUserId(e.target.value)}
            placeholder="User account id (auth.users uuid)"
            aria-label="Filter by user account identifier"
          />
          <select
            className={input}
            value={marketplaceProvider}
            onChange={(e) => setMarketplaceProvider(e.target.value)}
            aria-label="Filter by supplier type"
          >
            <option value="">All suppliers</option>
            <option value="expedia-rapid">Expedia</option>
            <option value="duffel">Duffel</option>
            <option value="amadeus">Amadeus</option>
          </select>
          <select
            className={input}
            value={marketplaceKind}
            onChange={(e) => setMarketplaceKind(e.target.value)}
            aria-label="Filter by booking type"
          >
            <option value="">All types</option>
            <option value="hotel">Hotel</option>
            <option value="flight">Flight</option>
            <option value="car">Car</option>
          </select>
          <select
            className={input}
            value={marketplaceStatus}
            onChange={(e) => setMarketplaceStatus(e.target.value)}
            aria-label="Filter by exact system state"
          >
            <option value="">All states</option>
            {LEDGER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            className={input}
            value={marketplaceSort}
            onChange={(e) => setMarketplaceSort(e.target.value)}
            aria-label="Sort ledger"
          >
            <option value="started_at_desc">Sort: started (newest)</option>
            <option value="started_at_asc">Sort: started (oldest)</option>
            <option value="updated_at_desc">Sort: updated (newest)</option>
            <option value="updated_at_asc">Sort: updated (oldest)</option>
            <option value="amount_desc">Sort: checkout cents (high)</option>
            <option value="amount_asc">Sort: checkout cents (low)</option>
          </select>
          <input type="date" className={input} value={marketplaceDateFrom} onChange={(e) => setMarketplaceDateFrom(e.target.value)} aria-label="Ledger date from" />
          <input type="date" className={input} value={marketplaceDateTo} onChange={(e) => setMarketplaceDateTo(e.target.value)} aria-label="Ledger date to" />
          <input
            className={input}
            type="number"
            min="0"
            step="0.01"
            value={amountMinDollars}
            onChange={(e) => setAmountMinDollars(e.target.value)}
            placeholder="Min checkout $"
            aria-label="Minimum total checkout amount"
          />
          <input
            className={input}
            type="number"
            min="0"
            step="0.01"
            value={amountMaxDollars}
            onChange={(e) => setAmountMaxDollars(e.target.value)}
            placeholder="Max checkout $"
            aria-label="Maximum total checkout amount"
          />
          <label className="flex items-center gap-2 text-sm text-white/80 md:col-span-2">
            <input type="checkbox" checked={marketplaceStaleOnly} onChange={(e) => setMarketplaceStaleOnly(e.target.checked)} />
            Stale open attempts only
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, confirmation, PI, status"
            className={`${input} md:col-span-2`}
            aria-label="Free-text ledger search"
          />
          <button
            type="button"
            className="rounded bg-[#d8ab2e] px-4 font-bold text-black md:col-span-2"
            onClick={() => void load()}
          >
            Apply ledger filters
          </button>
        </div>

        <form
          id="owner-override-form"
          onSubmit={(e) => void submitOverrideForm(e)}
          className="mt-5 grid gap-2 rounded border border-white/15 bg-black/20 p-4 md:grid-cols-2"
        >
          <h3 className="md:col-span-2 text-lg font-bold">Log internal ledger note</h3>
          <p className="md:col-span-2 text-sm text-white/60">
            Audit annotation only — does not verify, confirm, or change reservation status. Confirmation
            still requires paid checkout supplier capture or live supplier sync.
          </p>
          <p className="md:col-span-2 text-sm text-white/60">
            Writes a durable note into <code>travel_booking_transaction_events</code> without forging a
            supplier confirmation. Provide a transaction id and/or marketplace attempt id.
          </p>
          <label>
            Transaction ID
            <input
              className={input}
              value={overrideForm.transactionId}
              onChange={(e) => setOverrideForm((prev) => ({ ...prev, transactionId: e.target.value }))}
              placeholder="travel_booking_transactions.id"
            />
          </label>
          <label>
            Marketplace attempt ID
            <input
              className={input}
              value={overrideForm.attemptId}
              onChange={(e) => setOverrideForm((prev) => ({ ...prev, attemptId: e.target.value }))}
              placeholder="travel_marketplace_booking_attempts.id"
            />
          </label>
          <label>
            Event name
            <input
              className={input}
              value={overrideForm.eventName}
              onChange={(e) => setOverrideForm((prev) => ({ ...prev, eventName: e.target.value }))}
            />
          </label>
          <label className="md:col-span-2">
            Override note
            <textarea
              required
              className="min-h-24 w-full rounded bg-white p-3 text-black"
              value={overrideForm.note}
              onChange={(e) => setOverrideForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="What changed, why, and who authorized it"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-purple-700 px-4 py-3 font-bold md:col-span-2 disabled:opacity-50"
            disabled={busyAction.startsWith("log_override:")}
          >
            Save override to transactional ledger
          </button>
        </form>

        <h3 className="mt-6 text-xl font-bold">Marketplace booking attempts</h3>
        <div className="mt-3 grid gap-3">
          {(data.marketplaceAttempts || []).map((attempt: any) => (
            <article key={attempt.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#d8ab2e]">
                    {attempt.status}
                    {attempt.stale ? " · STALE" : ""}
                  </p>
                  <strong className="text-lg">
                    {attempt.kind} · {attempt.provider_key}
                  </strong>
                  <p className="text-sm text-white/65">
                    {attempt.attendee_email || attempt.user_id} ·{" "}
                    {[attempt.origin_label, attempt.destination_label].filter(Boolean).join(" → ") ||
                      attempt.destination_label ||
                      "Offer"}
                  </p>
                  <p className="text-sm text-white/55">
                    Attempt {attempt.id} · {money(attempt.total_amount_cents)} {attempt.currency} · Conf{" "}
                    {attempt.confirmation_number || "—"} · PI {attempt.payment_intent_id || "—"} · started{" "}
                    {new Date(attempt.started_at).toLocaleString()} · updated{" "}
                    {new Date(attempt.updated_at).toLocaleString()}
                  </p>
                  {attempt.failure_reason ? <p className="mt-1 text-sm text-red-300">{attempt.failure_reason}</p> : null}
                </div>
                <div className="grid min-w-[16rem] gap-2">
                  <button
                    type="button"
                    className="min-h-11 rounded bg-sky-800 px-3 font-semibold disabled:opacity-50"
                    disabled={busyAction === `sync_supplier_status:${attempt.id}`}
                    onClick={() => void runOps("sync_supplier_status", { attemptId: attempt.id })}
                  >
                    Query live supplier status
                  </button>
                  <textarea
                    className="min-h-16 w-full rounded bg-white p-2 text-black"
                    placeholder="Refund reason (required)"
                    value={refundReason[attempt.id] || ""}
                    onChange={(e) =>
                      setRefundReason((prev) => ({ ...prev, [attempt.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="min-h-11 rounded bg-red-900 px-3 font-semibold disabled:opacity-50"
                    disabled={
                      !attempt.has_payment_intent ||
                      attempt.status === "REFUNDED" ||
                      busyAction === `refund_stripe:${attempt.id}`
                    }
                    onClick={() =>
                      void runOps("refund_stripe", {
                        attemptId: attempt.id,
                        reason: refundReason[attempt.id] || "",
                      })
                    }
                  >
                    Execute Stripe reversal
                  </button>
                  <textarea
                    className="min-h-16 w-full rounded bg-white p-2 text-black"
                    placeholder="Internal override note for this attempt"
                    value={overrideNote[attempt.id] || ""}
                    onChange={(e) =>
                      setOverrideNote((prev) => ({ ...prev, [attempt.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="min-h-11 rounded bg-purple-800 px-3 font-semibold disabled:opacity-50"
                    disabled={busyAction === `log_override:${attempt.id}`}
                    onClick={() =>
                      void runOps("log_override", {
                        attemptId: attempt.id,
                        note: overrideNote[attempt.id] || "",
                        eventName: "owner_internal_override",
                      })
                    }
                  >
                    Log override for attempt
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <h3 className="mt-8 text-xl font-bold">Transactional ledger rows</h3>
        <p className="mt-1 text-sm text-white/55">
          Direct rows from <code>travel_booking_transactions</code> (marketplace + official hotel lanes).
        </p>
        <div className="mt-3 grid gap-3">
          {(data.bookingTransactions || []).map((txn: any) => (
            <article key={txn.id} className="rounded-xl border border-cyan-300/20 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-200">{txn.status}</p>
              <strong className="text-lg">
                {txn.lane} · {txn.kind} · {txn.provider_key || "no-provider"}
              </strong>
              <p className="text-sm text-white/65">
                {txn.attendee_email || txn.user_id} ·{" "}
                {[txn.origin_label, txn.destination_label].filter(Boolean).join(" → ") ||
                  txn.destination_label ||
                  "Transaction"}
              </p>
              <p className="text-sm text-white/55">
                Txn {txn.id}
                {txn.marketplace_attempt_id ? ` · attempt ${txn.marketplace_attempt_id}` : ""} ·{" "}
                {money(txn.total_amount_cents)} {txn.currency} · Conf {txn.confirmation_number || "—"} · PI{" "}
                {txn.payment_intent_id || "—"}
              </p>
              {txn.failure_reason ? <p className="mt-1 text-sm text-red-300">{txn.failure_reason}</p> : null}
              <div className="mt-3 grid min-w-[16rem] gap-2 md:max-w-sm">
                <button
                  type="button"
                  className="min-h-11 rounded bg-purple-800 px-3 font-semibold disabled:opacity-50"
                  disabled={busyAction === `log_override:${txn.id}`}
                  onClick={() => {
                    setOverrideForm({
                      transactionId: txn.id,
                      attemptId: txn.marketplace_attempt_id || "",
                      note: "",
                      eventName: "owner_internal_override",
                    });
                    document.getElementById("owner-override-form")?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }}
                >
                  Prefill override form
                </button>
                {txn.marketplace_attempt_id ? (
                  <>
                    <button
                      type="button"
                      className="min-h-11 rounded bg-sky-800 px-3 font-semibold disabled:opacity-50"
                      disabled={busyAction === `sync_supplier_status:${txn.marketplace_attempt_id}`}
                      onClick={() =>
                        void runOps("sync_supplier_status", {
                          attemptId: txn.marketplace_attempt_id,
                        })
                      }
                    >
                      Query live supplier status
                    </button>
                    <textarea
                      className="min-h-16 w-full rounded bg-white p-2 text-black"
                      placeholder="Refund reason (required)"
                      value={refundReason[txn.id] || ""}
                      onChange={(e) =>
                        setRefundReason((prev) => ({ ...prev, [txn.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="min-h-11 rounded bg-red-900 px-3 font-semibold disabled:opacity-50"
                      disabled={
                        !txn.has_payment_intent ||
                        txn.status === "REFUNDED" ||
                        busyAction === `refund_stripe:${txn.marketplace_attempt_id}`
                      }
                      onClick={() =>
                        void runOps("refund_stripe", {
                          attemptId: txn.marketplace_attempt_id,
                          reason: refundReason[txn.id] || "",
                        })
                      }
                    >
                      Execute Stripe reversal
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded bg-purple-900 px-3 font-semibold disabled:opacity-50"
                      disabled={busyAction === `log_override:${txn.marketplace_attempt_id}`}
                      onClick={() =>
                        void runOps("log_override", {
                          transactionId: txn.id,
                          attemptId: txn.marketplace_attempt_id,
                          note: overrideNote[txn.id] || `Owner reviewed transaction ${txn.id}`,
                          eventName: "owner_internal_override",
                        })
                      }
                    >
                      Log override comment
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="min-h-11 rounded bg-purple-900 px-3 font-semibold disabled:opacity-50"
                    disabled={busyAction === `log_override:${txn.id}`}
                    onClick={() =>
                      void runOps("log_override", {
                        transactionId: txn.id,
                        note: overrideNote[txn.id] || `Owner reviewed transaction ${txn.id}`,
                        eventName: "owner_internal_override",
                      })
                    }
                  >
                    Log override comment
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        <h3 className="mt-8 text-xl font-bold">Recent transaction events</h3>
        <div className="mt-3 grid gap-2">
          {(data.transactionEvents || []).map((event: any) => (
            <article key={event.id} className="rounded border border-white/10 px-3 py-2 text-sm">
              <strong>{event.event_name}</strong>
              <span className="text-white/55">
                {" "}
                · {event.from_status || "—"} → {event.to_status} · txn {event.transaction_id} ·{" "}
                {new Date(event.created_at).toLocaleString()}
              </span>
              {event.details?.note ? (
                <p className="mt-1 text-white/70">{String(event.details.note)}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#d8ab2e]/30 p-5">
        <p className="font-black tracking-[.15em] text-[#d8ab2e]">OFFICIAL HOUSING RESERVATIONS</p>
        <p className="mt-2 text-sm text-white/60">
          Live <code>travel_hotel_reservations</code> rows. Owners may cancel only. Confirmed status comes from
          paid marketplace checkout / supplier sync — manual verify is retired (HTTP 410).
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Attendee, email, hotel, confirmation, status, or date"
            className="min-h-12 flex-1 rounded bg-white p-3 text-black"
          />
          <button type="button" onClick={() => void load()} className="rounded bg-purple-700 px-5">
            Search reservations
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          {data.reservations.map((r: any) => (
            <article key={r.id} className="rounded border border-white/10 p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <strong>{r.hotel_name_snapshot}</strong>
                  <p>
                    {r.attendee_email || r.user_id} · {r.room_type}
                  </p>
                  <p>
                    {r.check_in} – {r.check_out} · {r.reservation_status}
                  </p>
                  <p className="text-white/60">Confirmation {mask(r.confirmation_number)}</p>
                </div>
                <div className="flex gap-2">
                  {r.reservation_status !== "canceled" ? (
                    <button
                      type="button"
                      onClick={() => void reservation(r.id, "cancel")}
                      className="min-h-11 rounded bg-red-900 px-3"
                    >
                      Mark canceled
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#d8ab2e]/30 p-5">
        <p className="font-black tracking-[.15em] text-[#d8ab2e]">OFFICIAL COGIC HOUSING DATA</p>
        <p className="mt-2 text-white/65">
          Toggle individual nights or submit a date-range edit. Every change writes to{" "}
          <code>travel_hotel_nightly_availability</code>.
        </p>

        <form onSubmit={(e) => void submitInventoryDates(e)} className="mt-4 grid gap-2 rounded border border-white/10 p-4 md:grid-cols-2">
          <label className="md:col-span-2">
            Room type
            <select name="roomTypeId" required className={input} defaultValue="">
              <option value="" disabled>
                Select room type
              </option>
              {data.hotels.flatMap((h: any) =>
                (h.travel_hotel_room_types || []).map((room: any) => (
                  <option key={room.id} value={room.id}>
                    {h.name} · {room.name}
                  </option>
                )),
              )}
            </select>
          </label>
          <label>
            From date
            <input name="fromDate" type="date" required className={input} />
          </label>
          <label>
            To date (inclusive)
            <input name="toDate" type="date" required className={input} />
          </label>
          <label>
            Status
            <select name="status" className={input} defaultValue="AVAILABLE">
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="UNAVAILABLE">UNAVAILABLE</option>
            </select>
          </label>
          <label>
            Nightly rate USD (optional)
            <input name="nightlyRateCents" type="number" min="0" step="1" className={input} placeholder="Leave blank to keep room rate" />
          </label>
          <button type="submit" className="rounded bg-purple-700 p-3 font-bold md:col-span-2">
            Save inventory date range
          </button>
        </form>

        <div className="mt-5 grid gap-5">
          {data.hotels.map((h: any) => (
            <article key={h.id} className="rounded-xl border border-white/10 p-5">
              <h3 className="text-xl font-bold">{h.name}</h3>
              <p className="text-[#d8ab2e]">
                {h.cogic_designation} {h.minimum_nights ? `· ${h.minimum_nights} night minimum` : ""}
              </p>
              <p className="text-sm text-white/60">
                Source: {h.source_type || "Admin"} · Verified:{" "}
                {h.source_verified_at ? new Date(h.source_verified_at).toLocaleString() : "Not recorded"}
              </p>
              {h.travel_hotel_room_types?.map((room: any) => (
                <details key={room.id} className="mt-3 rounded border border-white/10 p-3">
                  <summary>
                    {room.name} · ${(room.nightly_rate_cents / 100).toFixed(0)}
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {room.travel_hotel_nightly_availability?.map((n: any) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() =>
                          void availability(
                            n.id,
                            n.availability_status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
                          )
                        }
                        className={`rounded px-2 py-1 text-xs ${
                          n.availability_status === "AVAILABLE" ? "bg-green-700" : "bg-white/10"
                        }`}
                      >
                        {n.stay_date.slice(5)} {n.availability_status === "AVAILABLE" ? "$" : "—"}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#d8ab2e]/30 p-5">
        <p className="font-black tracking-[.15em] text-[#d8ab2e]">GETTING AROUND</p>
        <p className="mt-2 text-white/65">
          Publish airport and ground transportation guidance shown on /travel/getting-around.
        </p>

        <form onSubmit={(e) => void createGuide(e, "airport")} className="mt-4 grid gap-2 md:grid-cols-2">
          <input required name="iataCode" placeholder="IATA (STL)" className={input} />
          <input required name="name" placeholder="Airport name" className={input} />
          <textarea name="guidance" placeholder="Guidance" className={`${input} md:col-span-2`} />
          <input name="url" placeholder="URL" className={input} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="published" defaultChecked /> Published
          </label>
          <button className="rounded bg-purple-700 p-3 md:col-span-2">Create airport</button>
        </form>

        <form onSubmit={(e) => void createGuide(e, "transport")} className="mt-4 grid gap-2 md:grid-cols-2">
          <input required name="name" placeholder="Option name" className={input} />
          <select name="transportKind" className={input} defaultValue="rideshare">
            <option value="rideshare">Rideshare</option>
            <option value="public_transit">Public transit</option>
            <option value="parking">Parking</option>
            <option value="airport_transfer">Airport transfer</option>
            <option value="official_shuttle">Official shuttle</option>
            <option value="hotel_shuttle">Hotel shuttle</option>
            <option value="charter_bus">Charter bus</option>
            <option value="other">Other</option>
          </select>
          <textarea name="description" placeholder="Description" className={`${input} md:col-span-2`} />
          <input name="url" placeholder="URL" className={input} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="published" defaultChecked /> Published
          </label>
          <button className="rounded bg-purple-700 p-3 md:col-span-2">Create transportation option</button>
        </form>

        <div className="mt-5 grid gap-3">
          {[...data.airports, ...data.transport].map((row: any) => (
            <article key={row.id} className="rounded border border-white/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong>{row.name}</strong>
                  <p className="text-sm text-white/60">
                    {row.iata_code || row.kind} · {row.published ? "published" : "unpublished"}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded border border-white/20 px-3 py-1"
                  onClick={() =>
                    void togglePublish(row.iata_code ? "airport" : "transport", row.id, row.published)
                  }
                >
                  {row.published ? "Unpublish" : "Publish"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 p-5">
        <h2 className="text-2xl font-bold">Provider readiness diagnostics</h2>
        <p className="mt-2 text-white/60">
          Configuration and connectivity status only. Provider API keys and tokens are never shown.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["Expedia", data.marketplaceReadiness?.expediaConfigured],
            ["Duffel", data.marketplaceReadiness?.duffelConfigured],
            ["Amadeus", data.marketplaceReadiness?.amadeusConfigured],
          ].map(([label, configured]) => (
            <div key={String(label)} className="rounded border border-white/10 p-4">
              <strong>{label}</strong>
              <p>{configured ? "YES — configured" : "NO — not configured"}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded border border-white/10 p-4">
            <strong>Search operational</strong>
            <p>
              Hotels {data.marketplaceReadiness?.hotelsSearchOperational ? "YES" : "NO"} · Flights{" "}
              {data.marketplaceReadiness?.flightsSearchOperational ? "YES" : "NO"} · Cars{" "}
              {data.marketplaceReadiness?.carsSearchOperational ? "YES" : "NO"}
            </p>
          </div>
          <div className="rounded border border-white/10 p-4">
            <strong>In-app checkout fulfillment ready</strong>
            <p>
              {data.marketplaceReadiness?.checkoutFulfillmentOperational
                ? "YES — at least one of Expedia Rapid / Duffel can search and fulfill"
                : "NO — set EXPEDIA_RAPID_* and/or DUFFEL_* for live Elements checkout"}
            </p>
            <p className="mt-1 text-sm text-white/55">
              Source: <code>marketplaceReadiness.checkoutFulfillmentOperational</code>
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.providers.map((p: any) => (
            <div key={p.id} className="rounded border border-white/10 p-4">
              <strong>{p.name}</strong>
              <p>{p.configured ? "CONFIGURED" : "NOT CONFIGURED"}</p>
              <p className="text-sm text-white/60">Connection: {p.connection || "—"}</p>
              <p className="text-sm text-white/60">
                Last check: {p.lastCheckAt ? new Date(p.lastCheckAt).toLocaleString() : "None yet"}
                {p.lastCheckOk == null ? "" : p.lastCheckOk ? " · OK" : " · FAILED"}
              </p>
              {p.lastFailureMessage ? <p className="text-sm text-red-300">{p.lastFailureMessage}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
