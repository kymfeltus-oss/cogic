"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CatalogEvent = {
  id: string;
  slug: string;
  title: string;
  eventType: string;
  status: string;
  occurrenceCount: number;
  publishedOccurrenceCount: number;
};

type Occurrence = {
  id: string;
  eventId: string;
  title: string;
  titleOverride: string | null;
  eventTitle: string | null;
  eventType: string | null;
  localDate: string;
  timezone: string;
  startMode: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  venueLabel: string | null;
  visibility: string;
  status: string;
  eventStatus: string | null;
};

type SafeSource = {
  id: string;
  name: string;
  crewName: string;
  active: boolean;
  backup: boolean;
};

type Assignment = {
  occurrenceId: string;
  primarySourceId: string;
  backupSourceId: string | null;
};

type OccurrenceForm = {
  eventId: string;
  titleOverride: string;
  localDate: string;
  timezone: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  venueLabel: string;
  visibility: "unpublished" | "published";
  status: string;
};

const emptyForm = (): OccurrenceForm => ({
  eventId: "",
  titleOverride: "",
  localDate: "",
  timezone: "America/Chicago",
  scheduledStartAt: "",
  scheduledEndAt: "",
  venueLabel: "",
  visibility: "unpublished",
  status: "scheduled",
});

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string): string | null {
  if (!value.trim()) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
}

export default function EventManagementClient() {
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [sources, setSources] = useState<SafeSource[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);
  const [form, setForm] = useState<OccurrenceForm>(emptyForm);
  const [primarySourceId, setPrimarySourceId] = useState("");
  const [backupSourceId, setBackupSourceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");

  const loadAll = useCallback(async () => {
    const [eventsRes, occRes, sourcesRes] = await Promise.all([
      fetch("/api/owner/events", { credentials: "include", cache: "no-store" }),
      fetch("/api/owner/occurrences", { credentials: "include", cache: "no-store" }),
      fetch("/api/owner/production-sources", { credentials: "include", cache: "no-store" }),
    ]);

    if (eventsRes.status === 401 || eventsRes.status === 403) {
      throw new Error("Owner access denied. Sign in with an authorized operator account.");
    }
    if (!eventsRes.ok || !occRes.ok) {
      throw new Error("Unable to load event management data.");
    }

    const eventsData = (await eventsRes.json()) as { events?: CatalogEvent[] };
    const occData = (await occRes.json()) as { occurrences?: Occurrence[] };
    setEvents(eventsData.events ?? []);
    setOccurrences(occData.occurrences ?? []);

    if (sourcesRes.ok) {
      const sourceData = (await sourcesRes.json()) as {
        sources?: SafeSource[];
        assignments?: Assignment[];
      };
      setSources(sourceData.sources ?? []);
      setAssignments(sourceData.assignments ?? []);
    } else {
      setSources([]);
      setAssignments([]);
    }
  }, []);

  useEffect(() => {
    void loadAll().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Unable to load events.");
    });
  }, [loadAll]);

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const eventOccurrences = useMemo(
    () =>
      occurrences.filter((item) =>
        selectedEventId ? item.eventId === selectedEventId : true,
      ),
    [occurrences, selectedEventId],
  );

  function beginCreate(eventId?: string) {
    setMode("create");
    setSelectedOccurrenceId(null);
    setForm({
      ...emptyForm(),
      eventId: eventId || selectedEventId || "",
    });
    setPrimarySourceId("");
    setBackupSourceId("");
    setSuccess(null);
    setError(null);
  }

  function beginEdit(occurrence: Occurrence) {
    setMode("edit");
    setSelectedOccurrenceId(occurrence.id);
    setSelectedEventId(occurrence.eventId);
    setForm({
      eventId: occurrence.eventId,
      titleOverride: occurrence.titleOverride ?? "",
      localDate: occurrence.localDate,
      timezone: occurrence.timezone || "America/Chicago",
      scheduledStartAt: toLocalInputValue(occurrence.scheduledStartAt),
      scheduledEndAt: toLocalInputValue(occurrence.scheduledEndAt),
      venueLabel: occurrence.venueLabel ?? "",
      visibility: occurrence.visibility === "published" ? "published" : "unpublished",
      status: occurrence.status,
    });
    const assignment = assignments.find((item) => item.occurrenceId === occurrence.id);
    setPrimarySourceId(assignment?.primarySourceId ?? "");
    setBackupSourceId(assignment?.backupSourceId ?? "");
    setSuccess(null);
    setError(null);
  }

  async function saveOccurrence() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        eventId: form.eventId,
        titleOverride: form.titleOverride || null,
        localDate: form.localDate,
        timezone: form.timezone,
        startMode: "fixed",
        scheduledStartAt: fromLocalInputValue(form.scheduledStartAt),
        scheduledEndAt: fromLocalInputValue(form.scheduledEndAt),
        venueLabel: form.venueLabel || null,
        visibility: form.visibility,
        status: form.status,
      };

      const response =
        mode === "create"
          ? await fetch("/api/owner/occurrences", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/owner/occurrences/${selectedOccurrenceId}`, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      const data = (await response.json()) as { occurrence?: Occurrence; error?: string };
      if (!response.ok || !data.occurrence) {
        throw new Error(data.error || "Unable to save occurrence.");
      }

      if (primarySourceId) {
        const assignRes = await fetch("/api/owner/production-sources/assign", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            occurrenceId: data.occurrence.id,
            primarySourceId,
            backupSourceId: backupSourceId || null,
          }),
        });
        const assignData = (await assignRes.json()) as { error?: string };
        if (!assignRes.ok) {
          throw new Error(
            assignData.error ||
              "Occurrence saved, but broadcast source assignment failed.",
          );
        }
      }

      setSuccess(mode === "create" ? "Occurrence created." : "Occurrence updated.");
      await loadAll();
      beginEdit(data.occurrence);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save occurrence.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: "publish" | "unpublish" | "cancel") {
    if (!selectedOccurrenceId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/owner/occurrences/${selectedOccurrenceId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as { occurrence?: Occurrence; error?: string };
      if (!response.ok || !data.occurrence) {
        throw new Error(data.error || `Unable to ${action} occurrence.`);
      }
      setSuccess(`Occurrence ${action}ed.`);
      await loadAll();
      beginEdit(data.occurrence);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${action}.`);
    } finally {
      setSaving(false);
    }
  }

  async function publishCatalogEvent(eventId: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/owner/events", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, status: "published" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to publish catalog event.");
      setSuccess("Catalog event published.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish catalog event.");
    } finally {
      setSaving(false);
    }
  }

  const activeSources = sources.filter((item) => item.active);

  return (
    <div className="grid gap-2 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-ui text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#00a8ff]">
            Event Catalog
          </h2>
          <button
            type="button"
            onClick={() => beginCreate()}
            className="min-h-9 rounded-md border border-white/15 px-3 font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white"
          >
            Create occurrence
          </button>
        </div>
        <p className="mt-2 font-body text-xs text-white/55">
          Draft catalog only until you enter real dates. No fabricated schedule.
        </p>
        <ul className="mt-3 space-y-2">
          {events.length === 0 ? (
            <li className="rounded border border-dashed border-white/15 px-3 py-4 font-body text-xs text-white/55">
              No catalog events found for this program.
            </li>
          ) : (
            events.map((event) => {
              const active = selectedEventId === event.id;
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEventId(event.id);
                      beginCreate(event.id);
                    }}
                    className={`w-full rounded-md border px-3 py-3 text-left transition ${
                      active
                        ? "border-[#00a8ff]/50 bg-[#00a8ff]/10"
                        : "border-white/10 bg-black/30 hover:border-white/25"
                    }`}
                  >
                    <p className="font-ui text-[0.72rem] font-bold uppercase tracking-[0.08em] text-white">
                      {event.title}
                    </p>
                    <p className="mt-1 font-body text-[0.68rem] text-white/55">
                      {event.eventType.replaceAll("_", " ")} · {event.status} ·{" "}
                      {event.occurrenceCount} occurrence
                      {event.occurrenceCount === 1 ? "" : "s"}
                      {event.publishedOccurrenceCount > 0
                        ? ` (${event.publishedOccurrenceCount} published)`
                        : ""}
                    </p>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <div className="grid gap-2">
        <section className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-ui text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#ff2faf]">
              Occurrences
            </h2>
            {selectedEvent && selectedEvent.status !== "published" ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void publishCatalogEvent(selectedEvent.id)}
                className="min-h-9 rounded-md border border-[#00a8ff]/40 bg-[#00a8ff]/15 px-3 font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[#00a8ff] disabled:opacity-40"
              >
                Publish catalog event
              </button>
            ) : null}
          </div>

          {eventOccurrences.length === 0 ? (
            <p className="mt-3 rounded border border-dashed border-white/15 px-3 py-4 font-body text-xs text-white/55">
              No occurrences yet
              {selectedEvent ? ` for ${selectedEvent.title}` : ""}. Create one with real
              date/time values.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {eventOccurrences.map((occurrence) => (
                <li key={occurrence.id}>
                  <button
                    type="button"
                    onClick={() => beginEdit(occurrence)}
                    className={`w-full rounded-md border px-3 py-3 text-left ${
                      selectedOccurrenceId === occurrence.id
                        ? "border-[#ff2faf]/45 bg-[#ff2faf]/10"
                        : "border-white/10 bg-black/30"
                    }`}
                  >
                    <p className="font-ui text-[0.7rem] font-bold uppercase tracking-[0.08em] text-white">
                      {occurrence.title}
                    </p>
                    <p className="mt-1 font-body text-[0.68rem] text-white/55">
                      {occurrence.localDate}
                      {occurrence.scheduledStartAt
                        ? ` · ${new Date(occurrence.scheduledStartAt).toLocaleString()}`
                        : ""}
                      {occurrence.venueLabel ? ` · ${occurrence.venueLabel}` : ""}
                      {" · "}
                      {occurrence.visibility}/{occurrence.status}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-3">
          <h2 className="font-ui text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/80">
            {mode === "create" ? "Create occurrence" : "Edit occurrence"}
          </h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="font-body text-xs text-white/60">
              Catalog event
              <select
                value={form.eventId}
                disabled={mode === "edit"}
                onChange={(event) =>
                  setForm((current) => ({ ...current, eventId: event.target.value }))
                }
                className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white"
              >
                <option value="">Select event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-body text-xs text-white/60">
              Local date
              <input
                type="date"
                value={form.localDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, localDate: event.target.value }))
                }
                className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white"
              />
            </label>
            <label className="font-body text-xs text-white/60">
              Start
              <input
                type="datetime-local"
                value={form.scheduledStartAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scheduledStartAt: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white"
              />
            </label>
            <label className="font-body text-xs text-white/60">
              End (optional)
              <input
                type="datetime-local"
                value={form.scheduledEndAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scheduledEndAt: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white"
              />
            </label>
            <label className="font-body text-xs text-white/60">
              Venue / location
              <input
                type="text"
                value={form.venueLabel}
                onChange={(event) =>
                  setForm((current) => ({ ...current, venueLabel: event.target.value }))
                }
                className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white"
                placeholder="Optional real venue"
              />
            </label>
            <label className="font-body text-xs text-white/60">
              Title override
              <input
                type="text"
                value={form.titleOverride}
                onChange={(event) =>
                  setForm((current) => ({ ...current, titleOverride: event.target.value }))
                }
                className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white"
                placeholder="Optional"
              />
            </label>
            <label className="font-body text-xs text-white/60">
              Visibility
              <select
                value={form.visibility}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    visibility: event.target.value as "unpublished" | "published",
                  }))
                }
                className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white"
              >
                <option value="unpublished">unpublished (draft)</option>
                <option value="published">published</option>
              </select>
            </label>
            <label className="font-body text-xs text-white/60">
              Timezone
              <input
                type="text"
                value={form.timezone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, timezone: event.target.value }))
                }
                className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white"
              />
            </label>
          </div>

          <div className="mt-4 rounded border border-white/10 bg-black/25 p-3">
            <h3 className="font-ui text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#00a8ff]">
              Broadcast source assignment
            </h3>
            {activeSources.length === 0 ? (
              <p className="mt-2 font-body text-xs text-white/55">
                No approved broadcast sources configured.
              </p>
            ) : (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="font-body text-xs text-white/60">
                  Primary source
                  <select
                    value={primarySourceId}
                    onChange={(event) => setPrimarySourceId(event.target.value)}
                    className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white"
                  >
                    <option value="">Unassigned</option>
                    {activeSources
                      .filter((item) => !item.backup)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.crewName} — {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="font-body text-xs text-white/60">
                  Optional backup
                  <select
                    value={backupSourceId}
                    onChange={(event) => setBackupSourceId(event.target.value)}
                    className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white"
                  >
                    <option value="">Unconfigured</option>
                    {activeSources
                      .filter((item) => item.id !== primarySourceId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.crewName} — {item.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveOccurrence()}
              className="min-h-10 rounded-md bg-[#096bff] px-4 font-ui text-[0.62rem] font-bold uppercase tracking-[0.12em] text-white disabled:opacity-40"
            >
              {saving ? "Saving…" : mode === "create" ? "Save draft / create" : "Save changes"}
            </button>
            {mode === "edit" ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void runAction("publish")}
                  className="min-h-10 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-4 font-ui text-[0.62rem] font-bold uppercase tracking-[0.12em] text-emerald-300 disabled:opacity-40"
                >
                  Publish
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void runAction("unpublish")}
                  className="min-h-10 rounded-md border border-amber-300/40 bg-amber-300/10 px-4 font-ui text-[0.62rem] font-bold uppercase tracking-[0.12em] text-amber-200 disabled:opacity-40"
                >
                  Unpublish
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void runAction("cancel")}
                  className="min-h-10 rounded-md border border-rose-400/40 bg-rose-400/10 px-4 font-ui text-[0.62rem] font-bold uppercase tracking-[0.12em] text-rose-200 disabled:opacity-40"
                >
                  Cancel
                </button>
              </>
            ) : null}
          </div>

          {error ? (
            <p className="mt-3 font-body text-xs text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mt-3 font-body text-xs text-emerald-300" role="status">
              {success}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
