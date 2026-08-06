"use client";

import { useEffect, useMemo, useState } from "react";
import type { BroadcastAssignment, SafeBroadcastSource } from "@/lib/owner/production-sources";

type Occurrence = { id: string; title: string; localDate: string; status: string };

export default function ProductionSourceAssignments() {
  const [sources, setSources] = useState<SafeBroadcastSource[]>([]);
  const [assignments, setAssignments] = useState<BroadcastAssignment[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [occurrenceId, setOccurrenceId] = useState("");
  const [primarySourceId, setPrimarySourceId] = useState("");
  const [backupSourceId, setBackupSourceId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/owner/production-sources", { credentials: "include", cache: "no-store" }),
      fetch("/api/owner/occurrences", { credentials: "include", cache: "no-store" }),
    ]).then(async ([sourceResponse, occurrenceResponse]) => {
      if (!sourceResponse.ok || !occurrenceResponse.ok) throw new Error("Production sources are unavailable.");
      const sourceData = await sourceResponse.json();
      const occurrenceData = await occurrenceResponse.json();
      setSources(sourceData.sources ?? []);
      setAssignments(sourceData.assignments ?? []);
      setOccurrences(occurrenceData.occurrences ?? []);
    }).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load sources."));
  }, []);

  const selected = useMemo(() => assignments.find((item) => item.occurrenceId === occurrenceId), [assignments, occurrenceId]);
  const selectedPrimary = useMemo(() => sources.find((item) => item.id === primarySourceId) ?? null, [sources, primarySourceId]);

  function selectOccurrence(id: string) {
    setOccurrenceId(id);
    const assignment = assignments.find((item) => item.occurrenceId === id);
    setPrimarySourceId(assignment?.primarySourceId ?? "");
    setBackupSourceId(assignment?.backupSourceId ?? "");
  }

  async function save() {
    setSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/owner/production-sources/assign", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceId, primarySourceId, backupSourceId: backupSourceId || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save assignment.");
      setAssignments((current) => [...current.filter((item) => item.occurrenceId !== occurrenceId), { occurrenceId, primarySourceId, backupSourceId: backupSourceId || null }]);
      setMessage("Production source assignment saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save assignment."); }
    finally { setSaving(false); }
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h2 className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-blue">Event Production Source</h2>
      <p className="mt-2 font-body text-xs text-white/45">Assign only approved, operator-created sources. Credentials are never displayed.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="font-body text-xs text-white/60">Event occurrence
          <select value={occurrenceId} onChange={(event) => selectOccurrence(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white">
            <option value="">Select occurrence</option>
            {occurrences.map((item) => <option key={item.id} value={item.id}>{item.localDate} — {item.title}</option>)}
          </select>
        </label>
        <label className="font-body text-xs text-white/60">Primary source
          <select value={primarySourceId} onChange={(event) => setPrimarySourceId(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white">
            <option value="">Select source</option>
            {sources.filter((item) => item.active && !item.backup).map((item) => <option key={item.id} value={item.id}>{item.crewName} — {item.name}</option>)}
          </select>
        </label>
        <label className="font-body text-xs text-white/60">Optional backup
          <select value={backupSourceId} onChange={(event) => setBackupSourceId(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-white">
            <option value="">Unconfigured</option>
            {sources.filter((item) => item.active && item.id !== primarySourceId).map((item) => <option key={item.id} value={item.id}>{item.crewName} — {item.name}</option>)}
          </select>
        </label>
      </div>
      {selected ? <p className="mt-3 font-body text-xs text-white/45">This occurrence already has a persisted assignment.</p> : null}
      {selectedPrimary ? (
        <dl className="mt-4 grid gap-2 rounded border border-white/10 bg-black/30 p-3 font-body text-xs sm:grid-cols-4">
          <div><dt className="text-white/45">Crew</dt><dd className="text-white/85">{selectedPrimary.crewName}</dd></div>
          <div><dt className="text-white/45">Provider</dt><dd className="text-white/85">{selectedPrimary.provider === "ivs" ? "Amazon IVS" : selectedPrimary.provider}</dd></div>
          <div><dt className="text-white/45">Channel</dt><dd className="text-white/85">{selectedPrimary.channelName ?? "Not configured"}</dd></div>
          <div><dt className="text-white/45">Ingest</dt><dd className="text-white/85">{selectedPrimary.ingestProtocol.toUpperCase()}</dd></div>
          <div><dt className="text-white/45">Playback</dt><dd className="text-white/85">{selectedPrimary.playbackConfigured ? "Configured" : "Not configured"}</dd></div>
          <div><dt className="text-white/45">Recording</dt><dd className="text-white/85">{selectedPrimary.recordingConfigured ? "Configured" : "Not configured"}</dd></div>
          <div><dt className="text-white/45">Stream</dt><dd className="text-white/85">{selectedPrimary.operationalStatus === "live" ? "Live" : "Offline"}</dd></div>
          <div><dt className="text-white/45">Crew handoff</dt><dd className="text-white/85">{selectedPrimary.crewHandoffReady ? "Ready" : "Needs setup"}</dd></div>
        </dl>
      ) : null}
      <button type="button" disabled={saving || !occurrenceId || !primarySourceId} onClick={() => void save()} className="mt-4 min-h-10 rounded-full bg-brand-blue px-5 font-ui text-[0.62rem] font-bold uppercase tracking-[0.12em] text-black disabled:opacity-40">{saving ? "Saving…" : "Save assignment"}</button>
      {message ? <p className="mt-3 font-body text-xs text-white/70">{message}</p> : null}
    </section>
  );
}
