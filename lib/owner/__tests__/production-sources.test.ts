import assert from "node:assert/strict";
import test from "node:test";
import { resolveAssignedSources, serializeBroadcastSource } from "@/lib/owner/production-sources";

const rows = [
  { id: "source-a", crew_id: "crew-a", name: "Main", provider: "ivs", channel_name: "Main Channel", ingest_protocol: "rtmps", ingest_config_ref: "env:main", playback_configured: true, recording_configured: true, is_backup: false, priority: 1, operational_status: "ready", active: true, production_crews: { name: "Crew A" }, stream_key: "must-not-serialize", srt_passphrase: "must-not-serialize" },
  { id: "source-b", crew_id: "crew-b", name: "Music", provider: "ivs", channel_name: "Music Channel", ingest_protocol: "srt", ingest_config_ref: null, playback_configured: true, recording_configured: false, is_backup: false, priority: 2, operational_status: "offline", active: true, production_crews: { name: "Crew B" } },
];

test("multiple production sources remain distinct", () => {
  const safe = rows.map(serializeBroadcastSource);
  assert.equal(safe.length, 2);
  assert.notEqual(safe[0].crewId, safe[1].crewId);
});

test("event assignment resolves the selected source", () => {
  const safe = rows.map(serializeBroadcastSource);
  const assigned = resolveAssignedSources({ occurrenceId: "occurrence", primarySourceId: "source-b", backupSourceId: "source-a" }, safe);
  assert.equal(assigned.primary?.id, "source-b");
  assert.equal(assigned.backup?.id, "source-a");
});

test("source serialization excludes all secret and secret-reference fields", () => {
  const serialized = JSON.stringify(serializeBroadcastSource(rows[0]));
  assert.doesNotMatch(serialized, /stream_key|passphrase|must-not-serialize|ingest_config_ref|env:main/i);
});
