"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CTA_HREFS,
  ANNOUNCEMENT_PRIORITIES,
  type Announcement,
} from "@/lib/announcements/types";

type OwnerAnnouncement = Announcement & {
  readCount?: number;
  targetedRecipients?: number | null;
  unreadCount?: number | null;
  readPercentage?: number | null;
  pushDelivery?: {
    sent: number;
    failed: number;
    expired: number;
    queued: number;
  } | null;
};

type Occurrence = {
  id: string;
  title: string;
  localDate: string;
};

type FormState = {
  title: string;
  summary: string;
  body: string;
  category: string;
  priority: string;
  audience: string;
  pinned: boolean;
  eventOccurrenceId: string;
  ctaLabel: string;
  ctaHref: string;
  scheduledAt: string;
  expiresAt: string;
};

const emptyForm = (): FormState => ({
  title: "",
  summary: "",
  body: "",
  category: "general",
  priority: "normal",
  audience: "all_authenticated",
  pinned: false,
  eventOccurrenceId: "",
  ctaLabel: "",
  ctaHref: "",
  scheduledAt: "",
  expiresAt: "",
});

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value.trim()) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
}

export default function AnnouncementManagementClient() {
  const [items, setItems] = useState<OwnerAnnouncement[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [channels, setChannels] = useState({
    inApp: true,
    email: false,
    push: false,
    sms: false,
  });
  const [sendPush, setSendPush] = useState(false);
  const [eligiblePushDevices, setEligiblePushDevices] = useState(0);
  const [liveAutoAlertEnabled, setLiveAutoAlertEnabled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [annRes, occRes] = await Promise.all([
        fetch("/api/owner/announcements", { credentials: "include", cache: "no-store" }),
        fetch("/api/owner/occurrences", { credentials: "include", cache: "no-store" }),
      ]);
      if (annRes.status === 401 || annRes.status === 403) {
        throw new Error("Owner access denied. Sign in with an authorized operator account.");
      }
      if (!annRes.ok) throw new Error("Unable to load announcements.");
      const annJson = (await annRes.json()) as {
        announcements: OwnerAnnouncement[];
        channels?: typeof channels;
        eligiblePushDevices?: number;
        liveAutoAlertEnabled?: boolean;
      };
      setItems(annJson.announcements ?? []);
      if (annJson.channels) setChannels(annJson.channels);
      if (typeof annJson.eligiblePushDevices === "number") {
        setEligiblePushDevices(annJson.eligiblePushDevices);
      }
      setLiveAutoAlertEnabled(annJson.liveAutoAlertEnabled === true);
      if (occRes.ok) {
        const occJson = (await occRes.json()) as { occurrences?: Occurrence[] };
        setOccurrences(occJson.occurrences ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  function beginCreate() {
    setMode("create");
    setSelectedId(null);
    setForm(emptyForm());
    setSuccess(null);
    setError(null);
  }

  function beginEdit(item: OwnerAnnouncement) {
    setMode("edit");
    setSelectedId(item.id);
    setForm({
      title: item.title,
      summary: item.summary ?? "",
      body: item.body,
      category: item.category,
      priority: item.priority,
      audience: item.audience,
      pinned: item.pinned,
      eventOccurrenceId: item.eventOccurrenceId ?? "",
      ctaLabel: item.ctaLabel ?? "",
      ctaHref: item.ctaHref ?? "",
      scheduledAt: toLocalInput(item.scheduledAt),
      expiresAt: toLocalInput(item.expiresAt),
    });
    setSuccess(null);
    setError(null);
  }

  function payload() {
    return {
      title: form.title,
      summary: form.summary || null,
      body: form.body,
      category: form.category,
      priority: form.priority,
      audience: form.audience,
      pinned: form.pinned,
      eventOccurrenceId: form.eventOccurrenceId || null,
      ctaLabel: form.ctaLabel || null,
      ctaHref: form.ctaHref || null,
      scheduledAt: fromLocalInput(form.scheduledAt),
      expiresAt: fromLocalInput(form.expiresAt),
    };
  }

  async function createWithAction(action: "draft" | "schedule" | "publish") {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/owner/announcements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload(), action, sendPush }),
      });
      const data = (await response.json()) as {
        announcement?: Announcement;
        error?: string;
        push?: { sent?: number; failed?: number; queued?: number } | null;
      };
      if (!response.ok || !data.announcement) {
        throw new Error(data.error || "Unable to create announcement.");
      }
      const pushNote =
        data.push && typeof data.push.sent === "number"
          ? ` Push sent ${data.push.sent}/${data.push.queued ?? data.push.sent}.`
          : sendPush && action === "publish"
            ? " Push requested."
            : "";
      setSuccess(
        action === "publish"
          ? `Announcement published.${pushNote}`
          : action === "schedule"
            ? "Announcement scheduled."
            : "Draft saved.",
      );
      await load();
      beginEdit(data.announcement as OwnerAnnouncement);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/owner/announcements/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload(), action: "update" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save announcement.");
      setSuccess("Announcement saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: string) {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/owner/announcements/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          scheduledAt: fromLocalInput(form.scheduledAt),
          sendPush: action === "publish" ? sendPush : false,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        push?: { sent?: number; queued?: number } | null;
        pushResend?: { resent?: number };
      };
      if (!response.ok) throw new Error(data.error || "Unable to update announcement.");
      if (action === "resend_push_failed") {
        setSuccess(`Resent failed pushes: ${data.pushResend?.resent ?? 0}.`);
      } else if (data.push && typeof data.push.sent === "number") {
        setSuccess(
          `Announcement ${action} complete. Push sent ${data.push.sent}/${data.push.queued ?? data.push.sent}.`,
        );
      } else {
        setSuccess(`Announcement ${action} complete.`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update announcement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <section className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-ui text-xs font-black uppercase tracking-[0.14em] text-[#00a8ff]">
            Announcements
          </h2>
          <button
            type="button"
            onClick={beginCreate}
            className="rounded border border-white/15 px-2 py-1 text-[0.65rem] uppercase tracking-[0.1em] text-white/80"
          >
            New
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-white/60" role="status">
            Loading announcements…
          </p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-white/60" role="status">
            No announcements yet. Create a draft — nothing is public until published.
          </p>
        ) : (
          <ul className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => beginEdit(item)}
                  className={`w-full rounded border px-3 py-2 text-left transition ${
                    selectedId === item.id
                      ? "border-[#00a8ff]/55 bg-[#00a8ff]/12"
                      : "border-white/10 bg-black/20 hover:border-white/25"
                  }`}
                >
                  <span className="block truncate text-sm font-semibold text-white">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[0.65rem] uppercase tracking-[0.12em] text-white/50">
                    {item.status}
                    {item.pinned ? " · pinned" : ""}
                    {item.priority !== "normal" ? ` · ${item.priority}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-3">
        {(error || success) && (
          <div
            role={error ? "alert" : "status"}
            className={`rounded border px-3 py-2 text-sm ${
              error
                ? "border-red-400/40 bg-red-950/40 text-red-100"
                : "border-emerald-400/40 bg-emerald-950/30 text-emerald-100"
            }`}
          >
            {error || success}
          </div>
        )}

        <section className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-4">
          <h2 className="font-ui text-xs font-black uppercase tracking-[0.14em] text-[#ff2faf]">
            {mode === "create" ? "Create announcement" : "Edit announcement"}
          </h2>
          <div className="mt-3 rounded border border-white/10 bg-black/30 px-3 py-3">
            <p className="font-ui text-[0.65rem] uppercase tracking-[0.12em] text-[#00a8ff]">
              Delivery
            </p>
            <label className="mt-2 flex items-center gap-2 text-xs text-white/80">
              <input type="checkbox" checked readOnly disabled />
              In App (required)
            </label>
            <label className="mt-2 flex items-center gap-2 text-xs text-white/80">
              <input
                type="checkbox"
                checked={sendPush}
                disabled={!channels.push}
                onChange={(e) => setSendPush(e.target.checked)}
              />
              Device Push
              {channels.push
                ? ` — ${eligiblePushDevices} opted-in devices`
                : " — unavailable (configure VAPID)"}
            </label>
            <label className="mt-2 flex items-center gap-2 text-xs text-white/45">
              <input type="checkbox" checked={false} disabled />
              Email — unavailable
            </label>
            <p className="mt-2 text-[0.7rem] text-white/50">
              LIVE auto-alert:{" "}
              {liveAutoAlertEnabled
                ? "enabled (OFFLINE→LIVE authoritative transition)"
                : "disabled until Web Push VAPID is configured"}
            </p>
            {form.priority === "important" || form.priority === "urgent" ? (
              <p className="mt-1 text-[0.7rem] text-[#E8D48B]">
                {form.priority === "urgent"
                  ? "Urgent: prefer Device Push for high visibility (still requires user consent)."
                  : "Important: strongly consider enabling Device Push."}
              </p>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block text-xs text-white/70 md:col-span-2">
              Title
              <input
                value={form.title}
                onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-white/70 md:col-span-2">
              Summary
              <input
                value={form.summary}
                onChange={(e) => setForm((c) => ({ ...c, summary: e.target.value }))}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-white/70 md:col-span-2">
              Body
              <textarea
                value={form.body}
                onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))}
                rows={5}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-white/70">
              Category
              <select
                value={form.category}
                onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              >
                {ANNOUNCEMENT_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-white/70">
              Priority
              <select
                value={form.priority}
                onChange={(e) => setForm((c) => ({ ...c, priority: e.target.value }))}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              >
                {ANNOUNCEMENT_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-white/70">
              Audience
              <select
                value={form.audience}
                onChange={(e) => setForm((c) => ({ ...c, audience: e.target.value }))}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              >
                {ANNOUNCEMENT_AUDIENCES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-white/70">
              Event occurrence
              <select
                value={form.eventOccurrenceId}
                onChange={(e) =>
                  setForm((c) => ({ ...c, eventOccurrenceId: e.target.value }))
                }
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              >
                <option value="">None</option>
                {occurrences.map((occ) => (
                  <option key={occ.id} value={occ.id}>
                    {occ.localDate} — {occ.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-white/70">
              CTA label
              <input
                value={form.ctaLabel}
                onChange={(e) => setForm((c) => ({ ...c, ctaLabel: e.target.value }))}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-white/70">
              CTA route
              <select
                value={form.ctaHref}
                onChange={(e) => setForm((c) => ({ ...c, ctaHref: e.target.value }))}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              >
                <option value="">None</option>
                {ANNOUNCEMENT_CTA_HREFS.map((href) => (
                  <option key={href} value={href}>
                    {href}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-white/70">
              Schedule at
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((c) => ({ ...c, scheduledAt: e.target.value }))}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-white/70">
              Expires at
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((c) => ({ ...c, expiresAt: e.target.value }))}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-white/70 md:col-span-2">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm((c) => ({ ...c, pinned: e.target.checked }))}
              />
              Pin as important
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {mode === "create" ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createWithAction("draft")}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 font-ui text-xs uppercase tracking-[0.12em] text-white disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createWithAction("schedule")}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-[#C9A227]/45 px-4 font-ui text-xs uppercase tracking-[0.12em] text-[#E8D48B] disabled:opacity-50"
                >
                  Schedule
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createWithAction("publish")}
                  className="inline-flex min-h-11 items-center justify-center rounded bg-[#096bff] px-4 font-ui text-xs uppercase tracking-[0.12em] text-white disabled:opacity-50"
                >
                  Publish now
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveEdit()}
                  className="inline-flex min-h-11 items-center justify-center rounded bg-[#096bff] px-4 font-ui text-xs uppercase tracking-[0.12em] text-white disabled:opacity-50"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void runAction("publish")}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-emerald-400/40 px-4 font-ui text-xs uppercase tracking-[0.12em] text-emerald-200 disabled:opacity-50"
                >
                  Publish
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void runAction("unpublish")}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-amber-400/40 px-4 font-ui text-xs uppercase tracking-[0.12em] text-amber-100 disabled:opacity-50"
                >
                  Unpublish
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void runAction("schedule")}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-[#C9A227]/45 px-4 font-ui text-xs uppercase tracking-[0.12em] text-[#E8D48B] disabled:opacity-50"
                >
                  Schedule
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void runAction(selected?.pinned ? "unpin" : "pin")}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 font-ui text-xs uppercase tracking-[0.12em] text-white/80 disabled:opacity-50"
                >
                  {selected?.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void runAction("archive")}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 font-ui text-xs uppercase tracking-[0.12em] text-white/80 disabled:opacity-50"
                >
                  Archive
                </button>
              </>
            )}
          </div>

          {selected ? (
            <div className="mt-4 space-y-3">
              <div className="rounded border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/70">
                <p className="font-ui text-[0.65rem] uppercase tracking-[0.12em] text-[#00a8ff]">
                  Read statistics
                </p>
                <p className="mt-2">
                  Reads: {selected.readCount ?? 0}
                  {selected.targetedRecipients != null
                    ? ` · Targeted registered attendees: ${selected.targetedRecipients}`
                    : " · Targeted population unknown for this audience (no fabricated total)"}
                  {selected.readPercentage != null
                    ? ` · Read rate: ${selected.readPercentage}%`
                    : ""}
                </p>
              </div>
              <div className="rounded border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/70">
                <p className="font-ui text-[0.65rem] uppercase tracking-[0.12em] text-[#00a8ff]">
                  Push delivery
                </p>
                {selected.pushDelivery ? (
                  <p className="mt-2">
                    Sent {selected.pushDelivery.sent} · Failed {selected.pushDelivery.failed} ·
                    Expired {selected.pushDelivery.expired} · Queued/processing{" "}
                    {selected.pushDelivery.queued}
                  </p>
                ) : (
                  <p className="mt-2">No device push campaign for this announcement yet.</p>
                )}
                {selected.pushDelivery && selected.pushDelivery.failed > 0 ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void runAction("resend_push_failed")}
                    className="mt-2 inline-flex min-h-10 items-center justify-center rounded border border-amber-400/40 px-3 font-ui text-[0.65rem] uppercase tracking-[0.12em] text-amber-100 disabled:opacity-50"
                  >
                    Resend failed
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
