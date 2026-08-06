export type SafeProductionCrew = {
  id: string; name: string; active: boolean;
  contactName: string | null; contactEmail: string | null; contactPhone: string | null;
};

export type SafeBroadcastSource = {
  id: string; crewId: string; crewName: string; name: string;
  provider: "ivs" | "restream" | "external"; channelName: string | null;
  ingestProtocol: "rtmps" | "srt"; playbackConfigured: boolean;
  recordingConfigured: boolean; backup: boolean; priority: number;
  active: boolean; operationalStatus: "offline" | "ready" | "live" | "degraded";
  crewHandoffReady: boolean;
};

export type BroadcastAssignment = {
  occurrenceId: string; primarySourceId: string; backupSourceId: string | null;
};

type SourceRow = Record<string, unknown>;

/** Explicit allowlist: secret refs and credentials can never be serialized. */
export function serializeBroadcastSource(row: SourceRow): SafeBroadcastSource {
  const crew = Array.isArray(row.production_crews) ? row.production_crews[0] : row.production_crews;
  const crewRow = (crew && typeof crew === "object" ? crew : {}) as SourceRow;
  const protocol = row.ingest_protocol === "srt" ? "srt" : "rtmps";
  return {
    id: String(row.id), crewId: String(row.crew_id), crewName: String(crewRow.name ?? "Unknown crew"),
    name: String(row.name), provider: row.provider === "ivs" || row.provider === "restream" ? row.provider : "external",
    channelName: typeof row.channel_name === "string" ? row.channel_name : null,
    ingestProtocol: protocol, playbackConfigured: row.playback_configured === true,
    recordingConfigured: row.recording_configured === true, backup: row.is_backup === true,
    priority: typeof row.priority === "number" ? row.priority : 100, active: row.active === true,
    operationalStatus: row.operational_status === "live" || row.operational_status === "ready" || row.operational_status === "degraded" ? row.operational_status : "offline",
    crewHandoffReady: Boolean(row.ingest_config_ref),
  };
}

export function resolveAssignedSources(
  assignment: BroadcastAssignment | null,
  sources: SafeBroadcastSource[],
) {
  if (!assignment) return { primary: null, backup: null };
  return {
    primary: sources.find((source) => source.id === assignment.primarySourceId && source.active) ?? null,
    backup: assignment.backupSourceId
      ? sources.find((source) => source.id === assignment.backupSourceId && source.active) ?? null
      : null,
  };
}
