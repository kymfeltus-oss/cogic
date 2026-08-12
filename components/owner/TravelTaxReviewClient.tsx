"use client";

import { FormEvent, useEffect, useState } from "react";
import { TravelTableSkeleton } from "@/components/travel/TravelLoadingSkeleton";

type PendingProfile = {
  id: string;
  church_id: string;
  church_name: string | null;
  legal_name: string;
  ein: string;
  verification_status: string;
  certificate_content_type: string | null;
  certificate_byte_size: number | null;
  uploaded_at: string | null;
  created_at: string;
};

/**
 * Owner verification desk for church 501(c)(3) certificates in pending_review.
 * Approve → action verify; deny → action reject (requires notes ≥ 3 chars).
 */
export default function TravelTaxReviewClient() {
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/travel/corporate/tax-exempt/review", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        profiles?: PendingProfile[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "Unable to load pending tax profiles.");
      }
      setProfiles(Array.isArray(json.profiles) ? json.profiles : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pending tax profiles.");
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitReview(
    profileId: string,
    action: "verify" | "reject",
    internalNotes: string,
  ) {
    setBusyId(profileId);
    setError(null);
    setNotice(null);

    if (action === "reject" && internalNotes.length < 3) {
      setError("Denial requires owner notes (at least 3 characters).");
      setBusyId(null);
      return;
    }

    try {
      const res = await fetch("/api/owner/travel/corporate/tax-exempt/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          action,
          internalNotes: internalNotes || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Review update failed.");
      }
      setNotice(action === "verify" ? "Profile verified." : "Profile rejected.");
      setProfiles((prev) => prev.filter((row) => row.id !== profileId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review update failed.");
    } finally {
      setBusyId(null);
    }
  }

  function notesFromForm(form: HTMLFormElement) {
    return String(new FormData(form).get("internalNotes") ?? "").trim();
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>, profileId: string) {
    event.preventDefault();
    await submitReview(profileId, "verify", notesFromForm(event.currentTarget));
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-[#d8ab2e]/40 bg-[#0d1020] p-5">
        <p className="font-black tracking-[.15em] text-[#d8ab2e]">TAX EXEMPT REVIEW</p>
        <h2 className="mt-2 text-2xl font-bold">Pending certificates</h2>
        <TravelTableSkeleton columns={5} rows={3} />
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#d8ab2e]/40 bg-[#0d1020] p-5">
      <p className="font-black tracking-[.15em] text-[#d8ab2e]">TAX EXEMPT REVIEW</p>
      <h2 className="mt-2 text-2xl font-bold">Pending certificates</h2>
      <p className="mt-2 text-white/65">
        Live rows from <code>church_tax_profiles</code> with{" "}
        <code>verification_status = pending_review</code>. Verify or reject maps to{" "}
        <code>PATCH /api/owner/travel/corporate/tax-exempt/review</code>.
      </p>

      {error ? (
        <p className="mt-3 rounded border border-red-400/40 bg-red-400/10 p-3 text-red-200">{error}</p>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded border border-emerald-400/40 bg-emerald-400/10 p-3 text-emerald-100">
          {notice}
        </p>
      ) : null}

      {profiles.length === 0 ? (
        <p className="mt-4 text-center text-sm text-white/55">
          No certificates awaiting review.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead className="border-b border-white/15 text-xs uppercase tracking-wider text-white/55">
              <tr>
                <th className="p-3">Church</th>
                <th className="p-3">Legal name / EIN</th>
                <th className="p-3">File</th>
                <th className="p-3">Uploaded</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/80">
              {profiles.map((row) => (
                <tr key={row.id}>
                  <td className="p-3 align-top">
                    <p className="font-medium text-white">
                      {row.church_name || "Unnamed church"}
                    </p>
                    <p className="text-xs text-white/45">
                      church {row.church_id.slice(0, 8)}…
                    </p>
                  </td>
                  <td className="p-3 align-top">
                    <p className="font-medium text-white">{row.legal_name}</p>
                    <p className="font-mono text-xs text-white/55">{row.ein}</p>
                  </td>
                  <td className="p-3 align-top text-xs">
                    <p>{row.certificate_content_type || "—"}</p>
                    <p className="text-white/45">
                      {row.certificate_byte_size != null
                        ? `${Math.round(row.certificate_byte_size / 1024)} KB`
                        : "—"}
                    </p>
                  </td>
                  <td className="p-3 align-top text-xs">
                    {row.uploaded_at
                      ? new Date(row.uploaded_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="p-3 align-top">
                    <form
                      className="ml-auto grid max-w-sm gap-2"
                      onSubmit={(event) => void handleVerify(event, row.id)}
                    >
                      <input
                        name="internalNotes"
                        placeholder="Notes (required to deny)"
                        className="min-h-10 rounded border border-white/15 bg-black/40 px-2 text-white"
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="submit"
                          disabled={busyId === row.id}
                          className="min-h-10 rounded bg-emerald-400/90 px-3 text-xs font-semibold text-black disabled:opacity-60"
                        >
                          {busyId === row.id ? "Saving…" : "Verify"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          className="min-h-10 rounded border border-red-400/50 bg-red-400/15 px-3 text-xs font-semibold text-red-100 disabled:opacity-60"
                          onClick={(clickEvent) => {
                            const form = clickEvent.currentTarget.closest("form");
                            if (!form) return;
                            void submitReview(row.id, "reject", notesFromForm(form));
                          }}
                        >
                          Deny
                        </button>
                      </div>
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
