"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import RegistrationPolicyDocument from "@/components/registration/RegistrationPolicyDocument";

type ProductRow = { id: string; name: string };
type PolicyRow = {
  id: string;
  version: string;
  title: string;
  content: string;
  status: string;
  effective_at: string;
  published_at?: string | null;
  superseded_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  acceptanceCount: number;
};

type RegistrationRow = {
  id: string;
  registration_group_id: string | null;
  is_primary_registrant: boolean;
  relationship_to_primary: string | null;
  guardian_registration_id: string | null;
  status: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  requires_interpretation: boolean;
  preferred_language: string | null;
  date_of_birth: string | null;
  amount_cents: number | null;
  confirmation_reference: string | null;
  created_at: string;
  row_version?: number;
  registration_products?: { id: string; name: string; product_key: string } | { id: string; name: string; product_key: string }[] | null;
  registration_credentials?: { id: string; status: string; badge_code: string | null }[] | null;
  registration_payments?: {
    id: string;
    status: string;
    amount_cents: number | null;
    stripe_payment_intent_id: string | null;
  }[] | null;
  registration_groups?: {
    id: string;
    status: string;
    row_version?: number;
    registration_policy_acceptances?: Array<{
      policy_version: string;
      authorized_signer_name: string | null;
      agreement_signer_name: string | null;
      accepted_at: string | null;
    }>;
  } | {
    id: string;
    status: string;
    row_version?: number;
    registration_policy_acceptances?: Array<{
      policy_version: string;
      authorized_signer_name: string | null;
      agreement_signer_name: string | null;
      accepted_at: string | null;
    }>;
  }[] | null;
};

type PaginationState = {
  pageSize: number;
  nextCursor: string | null;
  hasMore: boolean;
  totalRecords: number;
};

type CorrectionDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  interpretationLanguage: string;
  juniorDob: string;
  reason: string;
};

const inputClass = "rounded border border-white/10 bg-black p-3 text-sm text-white";
const dateValue = (value: string) => (value ? new Date(value).toISOString().slice(0, 16) : "");

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function emptyCorrection(row: RegistrationRow): CorrectionDraft {
  return {
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    email: row.email ?? "",
    phone: row.mobile_phone ?? "",
    interpretationLanguage: row.preferred_language ?? "",
    juniorDob: row.date_of_birth ?? "",
    reason: "",
  };
}

export default function RegistrationManagementClient() {
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageSize: 50,
    nextCursor: null,
    hasMore: false,
    totalRecords: 0,
  });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [product, setProduct] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editing, setEditing] = useState<PolicyRow | null>(null);
  const [preview, setPreview] = useState<PolicyRow | null>(null);
  const [cancelReasonByGroup, setCancelReasonByGroup] = useState<Record<string, string>>({});
  const [refundReasonByRegistration, setRefundReasonByRegistration] = useState<Record<string, string>>({});
  const [correctionByRegistration, setCorrectionByRegistration] = useState<Record<string, CorrectionDraft>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reconciliationNotes, setReconciliationNotes] = useState<Record<string, string>>({});
  const [offlineReferences, setOfflineReferences] = useState<Record<string, string>>({});

  const loadPage = useCallback(
    async (mode: "replace" | "append") => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      if (product) params.set("product", product);
      params.set("pageSize", "50");
      if (mode === "append" && pagination.nextCursor) {
        params.set("cursor", pagination.nextCursor);
      }

      const response = await fetch(`/api/owner/registrations?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as {
        error?: string;
        data?: RegistrationRow[];
        registrations?: RegistrationRow[];
        products?: ProductRow[];
        policies?: PolicyRow[];
        pagination?: PaginationState;
      };
      if (!response.ok) {
        throw new Error(json.error || "Unable to load registrations.");
      }

      const pageData = json.data ?? json.registrations ?? [];
      setProducts(json.products ?? []);
      setPolicies(json.policies ?? []);
      setPagination(
        json.pagination ?? {
          pageSize: 50,
          nextCursor: null,
          hasMore: false,
          totalRecords: 0,
        },
      );
      setRegistrations((current) => (mode === "append" ? [...current, ...pageData] : pageData));
    },
    [pagination.nextCursor, product, q, status],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void loadPage("replace")
        .catch((loadError) => {
          setError(loadError instanceof Error ? loadError.message : "Unable to load registrations.");
        })
        .finally(() => setLoading(false));
    }, 150);
    return () => window.clearTimeout(timer);
  }, [q, status, product]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional filter reload

  async function mutate(method: string, body: Record<string, unknown>) {
    setError("");
    const response = await fetch("/api/owner/registrations", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(json.error || "Request failed.");
    }
    await loadPage("replace");
  }

  async function reconcile(registrationId: string, reconciliationAction: "verify_stripe" | "retry_webhook" | "offline_check") {
    const key = `reconcile:${registrationId}:${reconciliationAction}`;
    setBusyKey(key);
    try {
      await mutate("PATCH", { action: "reconcile_payment", id: registrationId, reconciliationAction, notes: reconciliationNotes[registrationId] ?? "", reference: offlineReferences[registrationId] ?? "" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reconcile payment.");
    } finally {
      setBusyKey(null);
    }
  }

  async function createPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await mutate("POST", {
        action: "create_policy",
        version: form.get("version"),
        title: form.get("title"),
        effectiveAt: form.get("effectiveAt"),
        content: form.get("content"),
      });
      event.currentTarget.reset();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create policy.");
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    try {
      await mutate("PATCH", {
        action: "edit_policy",
        id: editing.id,
        title: form.get("title"),
        effectiveAt: form.get("effectiveAt"),
        content: form.get("content"),
      });
      setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to edit policy.");
    }
  }

  async function publishPolicy(policy: PolicyRow) {
    const active = policies.find((item) => item.status === "published");
    const acknowledgeSupersede = Boolean(active);
    if (
      active &&
      !window.confirm(
        `Publish ${policy.version} and supersede active policy ${active.version}? The historical policy and all prior acceptance evidence will be preserved.`,
      )
    ) {
      return;
    }
    try {
      await mutate("PATCH", {
        action: "publish_policy",
        id: policy.id,
        acknowledgeSupersede,
      });
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to publish policy.");
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, RegistrationRow[]>();
    for (const row of registrations) {
      const key = row.registration_group_id || `legacy:${row.id}`;
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).map(([groupKey, members]) => {
      const primary =
        members.find((member) => member.is_primary_registrant) ?? members[0] ?? null;
      const group = asSingle(primary?.registration_groups);
      return {
        groupKey,
        groupId: primary?.registration_group_id ?? null,
        groupStatus: group?.status ?? primary?.status ?? "unknown",
        members,
        primary,
      };
    });
  }, [registrations]);

  const registrantName = (id: string | null) => {
    if (!id) return "Unavailable";
    const row = registrations.find((item) => item.id === id);
    return row ? `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() : "Unavailable";
  };

  async function cancelGroup(groupId: string) {
    const reason = (cancelReasonByGroup[groupId] ?? "").trim();
    if (reason.length < 8) {
      setError("Cancellation requires a reason of at least 8 characters.");
      return;
    }
    setBusyKey(`cancel:${groupId}`);
    try {
      await mutate("PATCH", {
        action: "cancel_registration",
        groupId,
        reason,
      });
      setCancelReasonByGroup((current) => ({ ...current, [groupId]: "" }));
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel group.");
    } finally {
      setBusyKey(null);
    }
  }

  async function refundRegistration(registrationId: string) {
    const reason = (refundReasonByRegistration[registrationId] ?? "").trim();
    if (reason.length < 8) {
      setError("Refund requires a reason of at least 8 characters.");
      return;
    }
    setBusyKey(`refund:${registrationId}`);
    try {
      const response = await fetch("/api/owner/registrations/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, reason }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Unable to refund registration.");
      }
      setRefundReasonByRegistration((current) => ({ ...current, [registrationId]: "" }));
      await loadPage("replace");
    } catch (refundError) {
      setError(refundError instanceof Error ? refundError.message : "Unable to refund registration.");
    } finally {
      setBusyKey(null);
    }
  }

  async function submitCorrection(registration: RegistrationRow) {
    const draft = correctionByRegistration[registration.id] ?? emptyCorrection(registration);
    const reason = draft.reason.trim();
    if (reason.length < 8) {
      setError("Correction requires an audit reason of at least 8 characters.");
      return;
    }

    const corrections: Record<string, string> = {};
    if (draft.firstName.trim()) corrections.firstName = draft.firstName.trim();
    if (draft.lastName.trim()) corrections.lastName = draft.lastName.trim();
    if (draft.email.trim()) corrections.email = draft.email.trim();
    if (draft.phone.trim()) corrections.phone = draft.phone.trim();
    if (draft.interpretationLanguage.trim() || registration.preferred_language) {
      corrections.interpretationLanguage = draft.interpretationLanguage.trim();
    }
    if (draft.juniorDob.trim()) corrections.juniorDob = draft.juniorDob.trim();

    setBusyKey(`correct:${registration.id}`);
    try {
      const response = await fetch("/api/owner/registrations/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId: registration.id,
          reason,
          expectedRegistrationVersion: registration.row_version ?? null,
          corrections,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Unable to correct attendee profile.");
      }
      await loadPage("replace");
    } catch (correctError) {
      setError(
        correctError instanceof Error ? correctError.message : "Unable to correct attendee profile.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="grid gap-3">
      <section className="rounded border border-white/10 bg-[#080b18] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Registration management</h2>
          <p className="text-sm text-white/60">Showing {registrations.length} of {pagination.totalRecords} matching attendee records.</p>
          <a
            className="text-sm text-purple-300 underline"
            href="/api/owner/registrations?format=csv"
          >
            Export CSV
          </a>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search attendee, email, or reference"
            className={inputClass}
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass}
          >
            <option value="">All statuses</option>
            {["draft", "submitted", "payment_pending", "confirmed", "canceled", "refunded"].map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
          <select
            value={product}
            onChange={(event) => setProduct(event.target.value)}
            className={inputClass}
          >
            <option value="">All products</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-red-300">
            {error}
          </p>
        ) : null}
        {loading ? <p className="mt-3 text-sm text-white/60">Loading registrations…</p> : null}

        <div className="mt-3 grid gap-3">
          {!loading && grouped.length === 0 ? (
            <p>No registrations match these filters.</p>
          ) : null}
          {grouped.map((group) => {
            const canCancel =
              Boolean(group.groupId) &&
              ["draft", "submitted", "payment_pending"].includes(group.groupStatus);
            return (
              <article
                key={group.groupKey}
                className="rounded border border-white/10 bg-[#050814] p-4"
              >
                <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Group {group.groupId ? group.groupId.slice(0, 8) : "legacy"} ·{" "}
                      {group.groupStatus}
                    </h3>
                    <p className="text-sm text-white/60">
                      {group.members.length} attendee{group.members.length === 1 ? "" : "s"}
                      {group.primary?.confirmation_reference
                        ? ` · ${group.primary.confirmation_reference}`
                        : ""}
                    </p>
                  </div>
                </header>

                <div className="grid gap-3">
                  {group.members.map((member) => {
                    const productRelation = asSingle(member.registration_products);
                    const payment = member.registration_payments?.[0] ?? null;
                    const credential = member.registration_credentials?.at(-1) ?? null;
                    const groupRelation = asSingle(member.registration_groups);
                    const acceptance = groupRelation?.registration_policy_acceptances?.[0];
                    const draft =
                      correctionByRegistration[member.id] ?? emptyCorrection(member);
                    const paidConfirmed =
                      member.status === "confirmed" && payment?.status === "paid";

                    return (
                      <details
                        key={member.id}
                        className="rounded border border-white/10 p-3"
                        open={member.is_primary_registrant}
                      >
                        <summary className="cursor-pointer font-medium">
                          {member.first_name} {member.last_name} · {member.status} ·{" "}
                          {productRelation?.name || "No product"}
                          {member.is_primary_registrant ? " · Primary" : ""}
                        </summary>
                        <div className="mt-2 grid gap-1 text-sm text-white/70">
                          <p>
                            {member.email || "Group member"}
                            {member.mobile_phone ? ` · ${member.mobile_phone}` : ""}
                          </p>
                          <p>
                            {member.is_primary_registrant
                              ? "Primary registrant"
                              : `Group member: ${member.relationship_to_primary}`}
                            {member.guardian_registration_id
                              ? ` · Guardian: ${registrantName(member.guardian_registration_id)}`
                              : ""}
                          </p>
                          <p>
                            Payment: {payment?.status || "No payment"}
                            {typeof payment?.amount_cents === "number"
                              ? ` · ${(payment.amount_cents / 100).toFixed(2)}`
                              : ""}{" "}
                            · Confirmation: {member.confirmation_reference || "Pending"}
                          </p>
                          <p>
                            Interpretation:{" "}
                            {member.requires_interpretation
                              ? `Yes — ${member.preferred_language}`
                              : "No"}
                          </p>
                          <p>Credential: {credential?.status || "Not issued"}</p>
                          <p>
                            Policy: {acceptance?.policy_version || "Not accepted"}
                            {acceptance?.accepted_at
                              ? ` · ${new Date(acceptance.accepted_at).toLocaleString()} · Authorized: ${acceptance.authorized_signer_name} · Agreement: ${acceptance.agreement_signer_name}`
                              : ""}
                          </p>
                        </div>

                        <form
                          className="mt-3 grid gap-2 rounded border border-white/10 p-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void submitCorrection(member);
                          }}
                        >
                          <h4 className="text-sm font-semibold text-white">
                            Audited profile correction
                          </h4>
                          <p className="text-xs text-white/50">
                            Allowlisted fields only. Pricing, status, and group structure cannot be
                            changed here.
                          </p>
                          <div className="grid gap-2 md:grid-cols-2">
                            <input
                              className={inputClass}
                              value={draft.firstName}
                              onChange={(event) =>
                                setCorrectionByRegistration((current) => ({
                                  ...current,
                                  [member.id]: { ...draft, firstName: event.target.value },
                                }))
                              }
                              placeholder="First name"
                            />
                            <input
                              className={inputClass}
                              value={draft.lastName}
                              onChange={(event) =>
                                setCorrectionByRegistration((current) => ({
                                  ...current,
                                  [member.id]: { ...draft, lastName: event.target.value },
                                }))
                              }
                              placeholder="Last name"
                            />
                            <input
                              className={inputClass}
                              value={draft.email}
                              onChange={(event) =>
                                setCorrectionByRegistration((current) => ({
                                  ...current,
                                  [member.id]: { ...draft, email: event.target.value },
                                }))
                              }
                              placeholder="Email"
                            />
                            <input
                              className={inputClass}
                              value={draft.phone}
                              onChange={(event) =>
                                setCorrectionByRegistration((current) => ({
                                  ...current,
                                  [member.id]: { ...draft, phone: event.target.value },
                                }))
                              }
                              placeholder="Phone"
                            />
                            <input
                              className={inputClass}
                              value={draft.interpretationLanguage}
                              onChange={(event) =>
                                setCorrectionByRegistration((current) => ({
                                  ...current,
                                  [member.id]: {
                                    ...draft,
                                    interpretationLanguage: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Interpretation language"
                            />
                            <input
                              className={inputClass}
                              type="date"
                              value={draft.juniorDob}
                              onChange={(event) =>
                                setCorrectionByRegistration((current) => ({
                                  ...current,
                                  [member.id]: { ...draft, juniorDob: event.target.value },
                                }))
                              }
                              placeholder="Junior date of birth"
                            />
                          </div>
                          <textarea
                            className={inputClass}
                            rows={2}
                            required
                            minLength={8}
                            value={draft.reason}
                            onChange={(event) =>
                              setCorrectionByRegistration((current) => ({
                                ...current,
                                [member.id]: { ...draft, reason: event.target.value },
                              }))
                            }
                            placeholder="Audit reason (required, 8+ characters)"
                          />
                          <button
                            type="submit"
                            disabled={busyKey === `correct:${member.id}`}
                            className="w-fit rounded bg-purple-700 px-3 py-2 text-sm disabled:opacity-50"
                          >
                            {busyKey === `correct:${member.id}`
                              ? "Saving correction…"
                              : "Save audited correction"}
                          </button>
                        </form>

                        {paidConfirmed ? (
                          <div className="mt-3 grid gap-2 rounded border border-amber-400/30 p-3">
                            <h4 className="text-sm font-semibold text-amber-100">
                              Stripe refund (server amount)
                            </h4>
                            <p className="text-xs text-white/55">
                              Refund amount is claimed from the paid ledger row. Client amounts are
                              rejected.
                            </p>
                            <textarea
                              className={inputClass}
                              rows={2}
                              minLength={8}
                              value={refundReasonByRegistration[member.id] ?? ""}
                              onChange={(event) =>
                                setRefundReasonByRegistration((current) => ({
                                  ...current,
                                  [member.id]: event.target.value,
                                }))
                              }
                              placeholder="Refund reason (required, 8+ characters)"
                            />
                            <button
                              type="button"
                              disabled={busyKey === `refund:${member.id}`}
                              className="w-fit rounded border border-amber-300/50 px-3 py-2 text-sm text-amber-100 disabled:opacity-50"
                              onClick={() => void refundRegistration(member.id)}
                            >
                              {busyKey === `refund:${member.id}`
                                ? "Submitting refund…"
                                : "Execute Stripe refund"}
                            </button>
                          </div>
                        ) : null}
                        {member.is_primary_registrant && ["submitted", "payment_pending", "confirmed"].includes(member.status) ? (
                          <div className="mt-3 grid gap-2 rounded border border-cyan-400/30 p-3">
                            <h4 className="text-sm font-semibold text-cyan-100">Payment exception reconciliation</h4>
                            <p className="text-xs text-white/55">Stripe verification and webhook replay read the recorded Checkout Session from the server. Offline checks require a traceable reference.</p>
                            <textarea className={inputClass} minLength={8} rows={2} value={reconciliationNotes[member.id] ?? ""} onChange={(event) => setReconciliationNotes((current) => ({ ...current, [member.id]: event.target.value }))} placeholder="Reconciliation notes (required, 8+ characters)" />
                            <input className={inputClass} value={offlineReferences[member.id] ?? ""} onChange={(event) => setOfflineReferences((current) => ({ ...current, [member.id]: event.target.value }))} placeholder="Offline check/reference number" />
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className="rounded border border-cyan-300/50 px-3 py-2 text-sm" disabled={busyKey?.startsWith(`reconcile:${member.id}`)} onClick={() => void reconcile(member.id, "verify_stripe")}>Verify against Stripe</button>
                              <button type="button" className="rounded border border-cyan-300/50 px-3 py-2 text-sm" disabled={busyKey?.startsWith(`reconcile:${member.id}`)} onClick={() => void reconcile(member.id, "retry_webhook")}>Retry webhook fulfillment</button>
                              {member.status !== "confirmed" ? <button type="button" className="rounded border border-amber-300/50 px-3 py-2 text-sm" disabled={busyKey?.startsWith(`reconcile:${member.id}`)} onClick={() => void reconcile(member.id, "offline_check")}>Record offline check</button> : null}
                            </div>
                          </div>
                        ) : null}
                      </details>
                    );
                  })}
                </div>

                {canCancel && group.groupId ? (
                  <div className="mt-3 grid gap-2 rounded border border-red-400/30 p-3">
                    <h4 className="text-sm font-semibold text-red-100">
                      Atomic group cancellation
                    </h4>
                    <textarea
                      className={inputClass}
                      rows={2}
                      minLength={8}
                      value={cancelReasonByGroup[group.groupId] ?? ""}
                      onChange={(event) =>
                        setCancelReasonByGroup((current) => ({
                          ...current,
                          [group.groupId as string]: event.target.value,
                        }))
                      }
                      placeholder="Cancellation reason (required, 8+ characters)"
                    />
                    <button
                      type="button"
                      disabled={busyKey === `cancel:${group.groupId}`}
                      className="w-fit rounded border border-red-400/40 px-3 py-2 text-sm disabled:opacity-50"
                      onClick={() => void cancelGroup(group.groupId as string)}
                    >
                      {busyKey === `cancel:${group.groupId}`
                        ? "Canceling group…"
                        : "Cancel registration group"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        {pagination.hasMore ? (
          <button
            type="button"
            className="mt-4 rounded border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
            disabled={loadingMore}
            onClick={() => {
              setLoadingMore(true);
              setError("");
              void loadPage("append")
                .catch((loadError) => {
                  setError(
                    loadError instanceof Error ? loadError.message : "Unable to load more.",
                  );
                })
                .finally(() => setLoadingMore(false));
            }}
          >
            {loadingMore ? "Loading more…" : "Load more"}
          </button>
        ) : null}
      </section>

      <section className="rounded border border-white/10 bg-[#080b18] p-4">
        <h2 className="text-xl font-bold">Policy versions</h2>
        <p className="text-sm text-white/60">
          Published and accepted versions are immutable. Create a new draft to revise policy
          language.
        </p>
        <form onSubmit={createPolicy} className="mt-3 grid gap-2">
          <input required name="version" placeholder="Version" className={inputClass} />
          <input required name="title" placeholder="Policy title" className={inputClass} />
          <input required name="effectiveAt" type="datetime-local" className={inputClass} />
          <textarea
            required
            name="content"
            rows={10}
            placeholder="Approved policy text"
            className={inputClass}
          />
          <button className="rounded bg-purple-700 p-3">Create draft version</button>
        </form>
        <div className="mt-4 grid gap-2">
          {policies.map((policy) => (
            <article key={policy.id} className="rounded border border-white/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <strong>
                    {policy.version} · {policy.title}
                  </strong>
                  <p className="capitalize">
                    {policy.status}
                    {policy.status === "published" ? " · Active" : ""} · {policy.acceptanceCount}{" "}
                    acceptance{policy.acceptanceCount === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-white/55">
                    Effective {new Date(policy.effective_at).toLocaleString()}
                    {policy.published_at
                      ? ` · Published ${new Date(policy.published_at).toLocaleString()}`
                      : ""}
                    {policy.superseded_at
                      ? ` · Retired/superseded ${new Date(policy.superseded_at).toLocaleString()}`
                      : ""}
                  </p>
                  <p className="text-xs text-white/55">
                    Created by {policy.created_by || "Unavailable"} · Last updated by{" "}
                    {policy.updated_by || "Unavailable"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPreview(policy)}>
                    Preview
                  </button>
                  {policy.status === "draft" ? (
                    <>
                      <button type="button" onClick={() => setEditing(policy)}>
                        Edit draft
                      </button>
                      <button type="button" onClick={() => void publishPolicy(policy)}>
                        {policies.some((item) => item.status === "published")
                          ? "Publish & supersede active"
                          : "Publish"}
                      </button>
                    </>
                  ) : null}
                  {policy.status === "published" ? (
                    <button
                      type="button"
                      className="text-red-200"
                      onClick={() =>
                        void mutate("PATCH", { action: "retire_policy", id: policy.id }).catch(
                          (retireError) =>
                            setError(
                              retireError instanceof Error
                                ? retireError.message
                                : "Unable to retire policy.",
                            ),
                        )
                      }
                    >
                      Retire
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {editing ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit policy draft"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4"
        >
          <form
            onSubmit={saveDraft}
            className="grid max-h-[90vh] w-full max-w-3xl gap-3 overflow-auto rounded-xl bg-[#0b0715] p-6"
          >
            <h2>Edit draft {editing.version}</h2>
            <input
              required
              name="title"
              defaultValue={editing.title}
              className={inputClass}
            />
            <input
              required
              name="effectiveAt"
              type="datetime-local"
              defaultValue={dateValue(editing.effective_at)}
              className={inputClass}
            />
            <textarea
              required
              name="content"
              rows={16}
              defaultValue={editing.content}
              className={inputClass}
            />
            <div className="flex gap-2">
              <button className="rounded bg-purple-700 px-4 py-2">Save draft</button>
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {preview ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Policy preview"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-[#0b0715] p-6">
            <RegistrationPolicyDocument
              title={preview.title}
              version={preview.version}
              content={preview.content}
              effectiveAt={preview.effective_at}
            />
            <button
              className="mt-4 rounded bg-purple-700 px-4 py-2"
              type="button"
              onClick={() => setPreview(null)}
            >
              Close preview
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
