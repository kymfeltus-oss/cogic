/**
 * Isolated Multi-Channel Audio Mixer Worker
 * Handles background telemetry analysis and triggers hot resets for zero-signal states.
 */

let diagnosticInterval = null;
let lastHealthyTimestamp = Date.now();

const MIXER_CONFIG = {
  STALE_HEARTBEAT_THRESHOLD_MS: 2000,
  SILENCE_THRESHOLD_DB: -60, // Floor noise cut-off
};

// Listen for messages from the main UI thread
self.onmessage = function (event) {
  const { type, payload } = event.data;

  switch (type) {
    case "INITIALIZE_ENGINE":
      startMonitoringLoop();
      break;

    case "PROCESS_METRICS":
      analyzeAudioTelemetry(payload);
      break;

    case "TERMINATE_ENGINE":
      if (diagnosticInterval) clearInterval(diagnosticInterval);
      self.close();
      break;
  }
};

function startMonitoringLoop() {
  if (diagnosticInterval) clearInterval(diagnosticInterval);

  diagnosticInterval = setInterval(() => {
    // Continually request updated sound analysis from the browser hardware nodes
    self.postMessage({ type: "REQUEST_FRESH_METRICS" });
  }, 500); // 2Hz frequency for responsive telemetry reporting
}

function analyzeAudioTelemetry(payload) {
  const { masterVolumeLevel, isContextSuspended, timestamp } = payload;
  const commands = [];

  // Check 1: Validate Telemetry Freshness
  const dataAge = Date.now() - timestamp;
  if (dataAge > MIXER_CONFIG.STALE_HEARTBEAT_THRESHOLD_MS) {
    commands.push({
      target: "PIPELINE",
      action: "MARK_TELEMETRY_STALE",
      reason: "Audio telemetry heartbeat is older than 2000ms.",
    });
  }

  // Check 2: Evaluate and Self-Heal Suspended Contexts
  if (isContextSuspended) {
    commands.push({
      target: "AUDIO_CONTEXT",
      action: "RESUME_CONTEXT",
      reason:
        "Web Audio Context was auto-suspended by browser security rules. Triggering wake-up.",
    });
  }

  // Check 3: Evaluate Total Audio Silence (vMix Master Level <= 0)
  if (masterVolumeLevel <= 0) {
    const durationSilent = Date.now() - lastHealthyTimestamp;

    // If silent for longer than 3 seconds, fire a hard self-healing notification
    if (durationSilent > 3000) {
      commands.push({
        target: "MIXER_NODES",
        action: "RECONSTRUCT_GAIN_INPUTS",
        reason:
          "Audio master registered absolute zero for 3+ seconds. Attempting automatic route recovery.",
      });
    }
  } else {
    // Update timestamp loop when signals are actively registering
    lastHealthyTimestamp = Date.now();
  }

  // Broadcast results back to the production console
  if (commands.length > 0) {
    self.postMessage({ type: "EXECUTE_SELF_HEALING", commands });
  } else {
    self.postMessage({
      type: "TELEMETRY_HEALTHY",
      payload: { masterLevel: masterVolumeLevel, state: "ACTIVE" },
    });
  }
}
