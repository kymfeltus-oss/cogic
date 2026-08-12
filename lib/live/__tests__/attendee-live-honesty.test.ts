import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendeeStatusMessage,
  isKnownAttendeeStreamId,
  mapBroadcastStateToAttendeeStatus,
  shouldDisplayViewerCount,
} from "../attendee-live-honesty";
import {
  applyLiveViewerDisplayBuffer,
  LIVE_VIEWER_DISPLAY_BUFFER,
} from "../../experience/live-viewer-count";
import { liveChatStore } from "../../liveChatStore";

describe("attendee live honesty", () => {
  it("accepts known singleton stream ids only", () => {
    assert.equal(isKnownAttendeeStreamId("current_event"), true);
    assert.equal(isKnownAttendeeStreamId("current"), true);
    assert.equal(isKnownAttendeeStreamId("main_stage"), true);
    assert.equal(isKnownAttendeeStreamId("unknown-stream"), false);
    assert.equal(isKnownAttendeeStreamId(""), false);
  });

  it("maps broadcast state to honest attendee statuses", () => {
    assert.equal(mapBroadcastStateToAttendeeStatus("live", true), "live");
    assert.equal(mapBroadcastStateToAttendeeStatus("imminent_live", false), "starting_soon");
    assert.equal(mapBroadcastStateToAttendeeStatus("scheduled", false), "scheduled");
    assert.equal(mapBroadcastStateToAttendeeStatus("offline", false), "offline");
  });

  it("uses honest empty/offline copy", () => {
    assert.equal(attendeeStatusMessage("offline"), "No broadcasts are live right now.");
    assert.equal(attendeeStatusMessage("unavailable"), "This broadcast is unavailable.");
    assert.match(attendeeStatusMessage("starting_soon"), /starting soon/i);
    assert.match(attendeeStatusMessage("scheduled"), /scheduled/i);
  });

  it("never invents viewer counts", () => {
    assert.equal(LIVE_VIEWER_DISPLAY_BUFFER, 0);
    assert.equal(applyLiveViewerDisplayBuffer(0), 0);
    assert.equal(applyLiveViewerDisplayBuffer(3), 3);
    assert.equal(shouldDisplayViewerCount(0), false);
    assert.equal(shouldDisplayViewerCount(2), true);
  });

  it("starts live chat store empty with no simulated messages", () => {
    liveChatStore.reset();
    assert.deepEqual(liveChatStore.getMessages(), []);
  });
});
