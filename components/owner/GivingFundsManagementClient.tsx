"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { GivingFund } from "@/lib/giving/types";

const input = "rounded border border-white/10 bg-black p-2 text-white";

export default function GivingFundsManagementClient() {
  const [funds, setFunds] = useState<GivingFund[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/owner/giving/funds", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load funds.");
    setFunds(payload.funds ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      void load().catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load funds.");
      });
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function createFund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/owner/giving/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundKey: String(form.get("fundKey") ?? ""),
          label: String(form.get("label") ?? ""),
          description: String(form.get("description") ?? ""),
          sortOrder: Number(form.get("sortOrder") ?? 0),
          active: true,
          published: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to create fund.");
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create fund.");
    } finally {
      setBusy(false);
    }
  }

  async function patchFund(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/owner/giving/funds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to update fund.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update fund.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      {error ? (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      ) : null}

      <section className="rounded border border-white/10 p-4">
        <h2 className="text-xl font-bold">Create fund</h2>
        <form onSubmit={createFund} className="mt-3 grid gap-2 md:grid-cols-2">
          <input required name="fundKey" placeholder="fund_key" className={input} />
          <input required name="label" placeholder="Label" className={input} />
          <input name="description" placeholder="Description" className={input} />
          <input
            name="sortOrder"
            type="number"
            defaultValue={0}
            placeholder="Sort order"
            className={input}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-purple-700 p-2 font-bold md:col-span-2"
          >
            Create fund
          </button>
        </form>
      </section>

      <section className="rounded border border-white/10 p-4">
        <h2 className="text-xl font-bold">Giving funds</h2>
        <div className="mt-3 grid gap-3">
          {funds.length === 0 ? (
            <p className="text-white/70">No giving funds configured.</p>
          ) : (
            funds.map((fund) => (
              <article key={fund.id ?? fund.key} className="rounded border border-white/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong>{fund.label}</strong>
                    <p className="text-sm text-white/70">
                      key: {fund.key} · order: {fund.sortOrder} ·{" "}
                      {fund.active ? "active" : "inactive"} ·{" "}
                      {fund.published !== false ? "published" : "unpublished"}
                    </p>
                    <p className="text-sm text-white/60">{fund.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded border border-white/20 px-2 py-1"
                      onClick={() =>
                        void patchFund(fund.id!, { active: !fund.active })
                      }
                    >
                      {fund.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded border border-white/20 px-2 py-1"
                      onClick={() =>
                        void patchFund(fund.id!, {
                          published: fund.published === false,
                        })
                      }
                    >
                      {fund.published === false ? "Publish" : "Unpublish"}
                    </button>
                  </div>
                </div>
                <form
                  className="mt-3 grid gap-2 md:grid-cols-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void patchFund(fund.id!, {
                      label: String(form.get("label") ?? ""),
                      description: String(form.get("description") ?? ""),
                      sortOrder: Number(form.get("sortOrder") ?? 0),
                    });
                  }}
                >
                  <input
                    name="label"
                    defaultValue={fund.label}
                    className={input}
                    required
                  />
                  <input
                    name="description"
                    defaultValue={fund.description}
                    className={input}
                  />
                  <input
                    name="sortOrder"
                    type="number"
                    defaultValue={fund.sortOrder}
                    className={input}
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded border border-white/20 px-2 py-1 md:col-span-3"
                  >
                    Save changes
                  </button>
                </form>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
