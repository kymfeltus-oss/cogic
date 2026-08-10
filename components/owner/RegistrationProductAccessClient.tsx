"use client";

import { useCallback, useEffect, useState } from "react";

type Product = {
  id: string;
  product_key: string;
  name: string;
  description: string | null;
  price_cents: number;
  active: boolean;
  public: boolean;
};

type Entitlement = {
  id: string;
  entitlement_key: string;
  name: string;
  entitlement_type: string;
  event_type: string | null;
  access_zone: string | null;
  preferred_hold_minutes: number | null;
  guardian_required: boolean;
  active: boolean;
};

type Assignment = {
  id: string;
  registration_product_id: string;
  entitlement_id: string;
  active: boolean;
};

type OwnerRegistrationConfig = {
  products: Product[];
  entitlements: Entitlement[];
  assignments: Assignment[];
};

const EMPTY_CONFIG: OwnerRegistrationConfig = {
  products: [],
  entitlements: [],
  assignments: [],
};

function formValue(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

export default function RegistrationProductAccessClient() {
  const [data, setData] = useState<OwnerRegistrationConfig>(EMPTY_CONFIG);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/owner/registration-products", { cache: "no-store" });
    const payload = (await response.json()) as OwnerRegistrationConfig & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load registration configuration.");
    }
    setData(payload);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load registration configuration.");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(payload: Record<string, unknown>) {
    const response = await fetch("/api/owner/registration-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? "Unable to save registration configuration.");
    }
  }

  async function patch(payload: Record<string, unknown>) {
    const response = await fetch("/api/owner/registration-products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? "Unable to update registration configuration.");
    }
  }

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await post({
        kind: "product",
        productKey: formValue(form, "key"),
        name: formValue(form, "name"),
        description: formValue(form, "description"),
        eligibilityDescription: formValue(form, "eligibility"),
        priceCents: Math.round(Number(formValue(form, "price")) * 100),
        registrationOpensAt: formValue(form, "opens"),
        registrationClosesAt: formValue(form, "closes"),
        capacity: formValue(form, "capacity"),
        badgeType: formValue(form, "badgeType"),
        sortOrder: Number(formValue(form, "sortOrder")),
        public: form.get("public") === "on",
      });
      event.currentTarget.reset();
    }, "Unable to create product.");
  }

  async function createEntitlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await post({
        kind: "entitlement",
        entitlementKey: formValue(form, "key"),
        name: formValue(form, "name"),
        description: formValue(form, "description"),
        entitlementType: formValue(form, "type"),
        eventType: formValue(form, "eventType"),
        eventId: formValue(form, "eventId"),
        eventOccurrenceId: formValue(form, "eventOccurrenceId"),
        venueKey: formValue(form, "venueKey"),
        accessZone: formValue(form, "accessZone"),
        validFrom: formValue(form, "validFrom"),
        validUntil: formValue(form, "validUntil"),
        preferredHoldMinutes: formValue(form, "hold"),
        usageLimit: formValue(form, "usageLimit"),
        guardianRequired: form.get("guardian") === "on",
        singleUse: form.get("singleUse") === "on",
      });
      event.currentTarget.reset();
    }, "Unable to create entitlement.");
  }

  function toggle(kind: "product" | "entitlement" | "assignment", id: string, active: boolean) {
    return run(() => patch({ kind, id, active }), "Unable to update configuration.");
  }

  function setProductVisibility(id: string, isPublic: boolean) {
    return run(() => patch({ kind: "product", id, public: isPublic }), "Unable to update product visibility.");
  }

  function assign(productId: string, entitlementId: string) {
    if (!entitlementId) {
      return;
    }
    void run(
      () => post({ kind: "assignment", productId, entitlementId }),
      "Unable to assign entitlement.",
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {error ? <p role="alert" className="xl:col-span-2 rounded border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100">{error}</p> : null}
      <form onSubmit={(event) => void createProduct(event)} className="grid gap-3 rounded border border-white/10 bg-[#080b18] p-4">
        <h2 className="font-headline text-2xl uppercase">Create registration product</h2>
        <p className="text-xs text-white/55">Configure products without granting access by name.</p>
        <input required name="key" pattern="[A-Za-z][A-Za-z0-9_]{1,63}" placeholder="Stable key, e.g. GENERAL_2026" className="rounded border border-white/15 bg-black/40 p-3" />
        <input required name="name" placeholder="Display name" className="rounded border border-white/15 bg-black/40 p-3" />
        <textarea name="description" placeholder="Description" className="rounded border border-white/15 bg-black/40 p-3" />
        <textarea name="eligibility" placeholder="Eligibility / approval description" className="rounded border border-white/15 bg-black/40 p-3" />
        <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs">Price in dollars<input required name="price" type="number" min="0" step="0.01" className="rounded border border-white/15 bg-black/40 p-3" /></label><label className="grid gap-1 text-xs">Capacity<input name="capacity" type="number" min="0" className="rounded border border-white/15 bg-black/40 p-3" /></label></div>
        <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs">Registration opens<input name="opens" type="datetime-local" className="rounded border border-white/15 bg-black/40 p-3" /></label><label className="grid gap-1 text-xs">Registration closes<input name="closes" type="datetime-local" className="rounded border border-white/15 bg-black/40 p-3" /></label></div>
        <div className="grid grid-cols-2 gap-2"><input name="badgeType" placeholder="Badge type" className="rounded border border-white/15 bg-black/40 p-3" /><input name="sortOrder" type="number" defaultValue="0" aria-label="Sort order" className="rounded border border-white/15 bg-black/40 p-3" /></div>
        <label className="flex gap-2 text-sm"><input name="public" type="checkbox" />Publicly selectable</label>
        <button disabled={busy} className="min-h-11 rounded bg-[#096bff] font-bold">Create product</button>
      </form>

      <form onSubmit={(event) => void createEntitlement(event)} className="grid gap-3 rounded border border-white/10 bg-[#080b18] p-4">
        <h2 className="font-headline text-2xl uppercase">Create controlled entitlement</h2>
        <input required name="key" pattern="[A-Za-z][A-Za-z0-9_]{1,63}" placeholder="Stable key, e.g. GENERAL_ENTRY" className="rounded border border-white/15 bg-black/40 p-3" />
        <input required name="name" placeholder="Admin-facing name" className="rounded border border-white/15 bg-black/40 p-3" />
        <textarea name="description" placeholder="Capability description" className="rounded border border-white/15 bg-black/40 p-3" />
        <select name="type" className="rounded border border-white/15 bg-black p-3"><option value="event_access">Event access</option><option value="seating">Seating</option><option value="housing">Housing</option><option value="content">Content</option><option value="item">Included item</option><option value="badge">Badge</option><option value="discount">Discount</option></select>
        <div className="grid grid-cols-2 gap-2"><input name="eventType" placeholder="Event type (optional)" className="rounded border border-white/15 bg-black/40 p-3" /><input name="accessZone" placeholder="Access zone" className="rounded border border-white/15 bg-black/40 p-3" /><input name="eventId" placeholder="Specific event UUID" className="rounded border border-white/15 bg-black/40 p-3" /><input name="eventOccurrenceId" placeholder="Specific occurrence UUID" className="rounded border border-white/15 bg-black/40 p-3" /><input name="venueKey" placeholder="Venue key" className="rounded border border-white/15 bg-black/40 p-3" /><input name="usageLimit" type="number" min="1" placeholder="Usage limit" className="rounded border border-white/15 bg-black/40 p-3" /></div>
        <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs">Valid from<input name="validFrom" type="datetime-local" className="rounded border border-white/15 bg-black/40 p-3" /></label><label className="grid gap-1 text-xs">Valid until<input name="validUntil" type="datetime-local" className="rounded border border-white/15 bg-black/40 p-3" /></label></div>
        <label className="grid gap-1 text-xs">Preferred hold minutes<input name="hold" type="number" min="0" className="rounded border border-white/15 bg-black/40 p-3" /></label>
        <div className="flex gap-5 text-sm"><label><input name="guardian" type="checkbox" /> Guardian required</label><label><input name="singleUse" type="checkbox" /> Single use</label></div>
        <button disabled={busy} className="min-h-11 rounded bg-[#7b2cbf] font-bold">Create entitlement</button>
      </form>

      <section className="xl:col-span-2 rounded border border-white/10 bg-[#080b18] p-4">
        <h2 className="font-headline text-2xl uppercase">Product access matrix</h2>
        {data.products.length === 0 ? <p className="mt-3 text-sm text-white/55">No products configured. Create only approved real products.</p> : <div className="mt-3 grid gap-3">{data.products.map((product) => {
          const assignments = data.assignments.filter((assignment) => assignment.registration_product_id === product.id && assignment.active);
          const availableEntitlements = data.entitlements.filter((entitlement) => entitlement.active && !assignments.some((assignment) => assignment.entitlement_id === entitlement.id));
          return <article key={product.id} className="rounded border border-white/10 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{product.name}</strong><p className="text-xs text-white/50">{product.product_key} · ${(product.price_cents / 100).toFixed(2)} · {product.public ? "Public" : "Private"}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void setProductVisibility(product.id, !product.public)} className="rounded border border-cyan-300/30 px-3 py-2 text-xs">{product.public ? "Make private" : "Publish to attendees"}</button><button type="button" disabled={busy} onClick={() => void toggle("product", product.id, !product.active)} className="rounded border border-white/15 px-3 py-2 text-xs">{product.active ? "Deactivate" : "Activate"}</button></div></div><div className="mt-3 flex flex-wrap gap-2">{assignments.map((assignment) => { const entitlement = data.entitlements.find((candidate) => candidate.id === assignment.entitlement_id); return entitlement ? <button key={assignment.id} type="button" disabled={busy} onClick={() => void toggle("assignment", assignment.id, false)} title="Remove assignment" className="rounded-full border border-purple-400/40 bg-purple-500/10 px-3 py-1 text-xs">{entitlement.name} ×</button> : null; })}</div><label className="mt-3 flex gap-2 text-xs">Assign entitlement<select defaultValue="" onChange={(event) => { assign(product.id, event.target.value); event.target.value = ""; }} className="rounded border border-white/15 bg-black p-2"><option value="">Select…</option>{availableEntitlements.map((entitlement) => <option key={entitlement.id} value={entitlement.id}>{entitlement.name} ({entitlement.entitlement_key})</option>)}</select></label></article>;
        })}</div>}
      </section>
    </div>
  );
}
