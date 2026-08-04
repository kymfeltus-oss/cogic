import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/20260801120800_events_and_event_occurrences.sql",
);

describe("events migration contract (Gate A)", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  it("targets the approved tables and program key", () => {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.events/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.event_occurrences/);
    assert.match(sql, /cogic-stream-2026/);
    assert.match(sql, /wjlaaluonxiaxmytiqwi|tezzihhkqlovynybaypu/);
  });

  it("encodes event_type and status checks", () => {
    for (const type of [
      "main_service",
      "revival_fire",
      "midnight_musical",
      "main_event_center_class",
      "morning_manna",
      "midday_worship",
      "special_event",
    ]) {
      assert.match(sql, new RegExp(`'${type}'`));
    }
    assert.match(sql, /events_event_type_check/);
    assert.match(sql, /events_status_check/);
    assert.match(sql, /UNIQUE \(program_key, slug\)/);
  });

  it("encodes occurrence constraints", () => {
    assert.match(sql, /event_occurrences_fixed_requires_start/);
    assert.match(sql, /event_occurrences_after_requires_follow/);
    assert.match(sql, /event_occurrences_no_self_follow/);
    assert.match(sql, /event_occurrences_end_after_start/);
    assert.match(sql, /event_occurrences_status_check/);
    assert.match(sql, /event_occurrences_visibility_check/);
  });

  it("encodes Revival Fire follow validation and Midnight Musical separation", () => {
    assert.match(sql, /validate_occurrence_follow_relationship/);
    assert.match(sql, /revival_fire after_predecessor/);
    assert.match(sql, /main_service/);
    assert.match(sql, /cannot follow midnight_musical/);
    assert.match(sql, /midnight-musical/);
    assert.match(sql, /'midnight_musical'/);
  });

  it("enables RLS published-only SELECT policies without anon writes", () => {
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /events_select_published/);
    assert.match(sql, /event_occurrences_select_published/);
    assert.match(sql, /status = 'published'/);
    assert.match(sql, /visibility = 'published' AND status <> 'canceled'/);
    assert.doesNotMatch(sql, /FOR INSERT\s+TO anon/);
    assert.doesNotMatch(sql, /FOR UPDATE\s+TO authenticated/);
  });

  it("seeds draft catalog only (no fake occurrences)", () => {
    assert.match(sql, /INSERT INTO public\.events/);
    assert.match(sql, /evening-worship/);
    assert.match(sql, /revival-fire/);
    assert.match(sql, /main-event-center-classes/);
    assert.doesNotMatch(sql, /INSERT INTO public\.event_occurrences/);
    assert.match(sql, /'draft'/);
  });

  it("keeps broadcast/replay refs soft", () => {
    assert.match(sql, /broadcast_state_id\s+text/);
    assert.match(sql, /replay_recording_id\s+uuid/);
    assert.doesNotMatch(
      sql,
      /broadcast_state_id\s+text\s+NULL\s+REFERENCES public\.live_stream_state/,
    );
  });
});
