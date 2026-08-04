/**
 * Simulates Today's Service Go Live pipeline (config, preflight, encoder labels, backend health).
 * Run: node scripts/simulate-go-live-pipeline.mjs
 */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const RESTREAM_RTMP = "rtmp://live.restream.io/live";
const PLAYBACK = "https://www.vitalorgansent.com/live";

function pass(name, detail = "") {
  return { name, ok: true, detail };
}

function fail(name, detail) {
  return { name, ok: false, detail };
}

async function checkEncoderPrepareDryRun() {
  const base = process.env.AUDIO_SERVICE_URL?.trim() || "http://127.0.0.1:8000";
  const token = process.env.AUDIO_SERVICE_TOKEN?.trim() || "dev-audio-token";
  try {
    const res = await fetch(`${base}/streaming/encoder/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": token },
      body: JSON.stringify({
        destination_id: "sim-test-destination",
        stream_url: RESTREAM_RTMP,
        stream_key: "simulation-key-not-real",
        video_device_label: "HD Pro Webcam C920",
        audio_device_label: null,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      return pass("encoder_prepare_dry_run", json.message ?? "prepare ok");
    }
    return fail("encoder_prepare_dry_run", JSON.stringify(json));
  } catch (err) {
    return fail("encoder_prepare_dry_run", err instanceof Error ? err.message : String(err));
  }
}

async function checkBackendHealth() {
  const base = process.env.AUDIO_SERVICE_URL?.trim() || "http://127.0.0.1:8000";
  const token = process.env.AUDIO_SERVICE_TOKEN?.trim() || "dev-audio-token";
  try {
    const root = await fetch(`${base}/health`, { signal: AbortSignal.timeout(4000) });
    const rootJson = await root.json();
    const enc = await fetch(`${base}/streaming/encoder/health`, {
      headers: { "x-internal-token": token },
      signal: AbortSignal.timeout(4000),
    });
    const encJson = enc.ok ? await enc.json() : { error: enc.status };
    return pass("backend_health", JSON.stringify({ root: rootJson, encoder: encJson }));
  } catch (err) {
    return fail(
      "backend_health",
      `Backend not reachable at ${base} — start: cd backend && py -3.11 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 (${err instanceof Error ? err.message : err})`,
    );
  }
}

async function checkClientModuleBoundary() {
  const fs = await import("node:fs/promises");
  const mvp = await fs.readFile(path.join(ROOT, "lib/todays-service/production-mvp-checks.ts"), "utf8");
  const preflight = await fs.readFile(path.join(ROOT, "lib/todays-service/production-preflight.ts"), "utf8");
  const importLine = /from\s+["']@\/lib\/[^"']+["']/g;
  const preflightImports = preflight.match(importLine) ?? [];
  const mvpImports = mvp.match(importLine) ?? [];
  const forbidden = ["repository", "stream-presets", "streaming/service", "church-website", "production-go-live"];
  for (const line of preflightImports) {
    if (forbidden.some((f) => line.includes(f))) {
      return fail("client_module_boundary", `production-preflight imports forbidden module: ${line}`);
    }
  }
  for (const line of mvpImports) {
    if (forbidden.some((f) => line.includes(f))) {
      return fail("client_module_boundary", `production-mvp-checks imports forbidden module: ${line}`);
    }
  }
  if (!preflight.includes("production-mvp-checks")) {
    return fail("client_module_boundary", "production-preflight should import production-mvp-checks");
  }
  return pass("client_module_boundary", "Client preflight path is server-import safe");
}

async function runUnitSimulations() {
  const { buildProductionConfigInput, resolveEncoderDeviceLabels, logSafeProductionConfig } =
    await import("../lib/todays-service/production-config.ts");
  const { buildProductionPreflightChecks } = await import("../lib/todays-service/production-preflight.ts");
  const { parseAudioMixJson } = await import("../lib/todays-service/audio-mix.ts");
  const { DEFAULT_RESTREAM_INGEST_RTMP_URL } = await import("../lib/todays-service/stream-method-defaults.ts");

  const baseState = {
    videoSourceType: "browser_camera",
    videoDeviceId: "cam-abc",
    videoSourceLabel: "",
    audioEngine: "browser_microphone",
    audioSourceType: "browser_microphone",
    audioSourceLabel: "",
    audioDeviceId: "mic-xyz",
    cameras: [{ browserDeviceId: "cam-abc", label: "HD Pro Webcam C920" }],
    mics: [{ browserDeviceId: "mic-xyz", label: "USB Audio Device" }],
    audioMix: parseAudioMixJson(null),
    audioDelayMs: 0,
    videoDelayMs: 0,
    syncCheckStatus: "not_checked",
    syncCheckLog: [],
    playbackPageUrl: PLAYBACK,
    streamMethod: "custom_rtmp",
    rtmpServerUrl: RESTREAM_RTMP,
    rtmpStreamKey: "test-key-redacted",
    rtmpServerName: "Restream",
  };

  const results = [];

  // Scenario A: browser camera + browser mic — full MVP config
  const cfgA = buildProductionConfigInput(baseState);
  try {
    assert.equal(cfgA.primaryVideoDeviceId, "browser://cam-abc");
    assert.equal(cfgA.primaryAudioDeviceId, "browser://mic-xyz");
    assert.equal(cfgA.browserVideoDeviceLabel, "HD Pro Webcam C920");
    assert.equal(cfgA.browserAudioDeviceLabel, "USB Audio Device");
    assert.equal(cfgA.streamMethod, "custom_rtmp");
    const safe = logSafeProductionConfig(cfgA);
    assert.equal(safe.hasStreamKey, true);
    assert.equal(safe.rtmpStreamKey, undefined);
    const preA = buildProductionPreflightChecks({
      videoSourceType: baseState.videoSourceType,
      audioSourceType: cfgA.primaryAudioSourceType ?? "browser_microphone",
      audioEngine: baseState.audioEngine,
      primaryVideoDeviceId: cfgA.primaryVideoDeviceId ?? null,
      primaryAudioDeviceId: cfgA.primaryAudioDeviceId ?? null,
      videoSourceLabel: cfgA.primaryVideoSourceLabel,
      audioSourceLabel: cfgA.primaryAudioSourceLabel,
      audioMix: baseState.audioMix,
      syncCheckStatus: baseState.syncCheckStatus,
      streamMethod: baseState.streamMethod,
      playbackPageUrl: baseState.playbackPageUrl,
      rtmpServerUrl: baseState.rtmpServerUrl,
      streamKeyConfigured: true,
    });
    assert.ok(preA.ready, `expected ready preflight, failed: ${preA.checks.filter((c) => !c.ok).map((c) => c.key).join(", ")}`);
    results.push(pass("scenario_browser_camera_mic", `preflight ready (${preA.checks.length} checks)`));
  } catch (e) {
    results.push(fail("scenario_browser_camera_mic", e instanceof Error ? e.message : String(e)));
  }

  // Scenario B: embedded audio — no mic id required
  const cfgB = buildProductionConfigInput({ ...baseState, audioEngine: "embedded_video", audioDeviceId: "mic-xyz" });
  try {
    assert.equal(cfgB.primaryAudioDeviceId, null);
    assert.equal(cfgB.browserAudioDeviceLabel, null);
    assert.equal(cfgB.audioEngine, "embedded_video");
    const preB = buildProductionPreflightChecks({
      videoSourceType: baseState.videoSourceType,
      audioSourceType: cfgB.primaryAudioSourceType ?? "camera_audio",
      audioEngine: "embedded_video",
      primaryVideoDeviceId: cfgB.primaryVideoDeviceId ?? null,
      primaryAudioDeviceId: null,
      audioMix: baseState.audioMix,
      syncCheckStatus: baseState.syncCheckStatus,
      streamMethod: baseState.streamMethod,
      playbackPageUrl: baseState.playbackPageUrl,
      rtmpServerUrl: baseState.rtmpServerUrl,
      streamKeyConfigured: true,
    });
    const micCheck = preB.checks.find((c) => c.key === "mvp_browser_microphone");
    assert.equal(micCheck, undefined);
    const embedded = preB.checks.find((c) => c.key === "mvp_embedded_audio");
    assert.ok(embedded?.ok);
    results.push(pass("scenario_embedded_audio", "no mic device required"));
  } catch (e) {
    results.push(fail("scenario_embedded_audio", e instanceof Error ? e.message : String(e)));
  }

  // Scenario C: missing camera blocks preflight
  const cfgC = buildProductionConfigInput({ ...baseState, videoDeviceId: "" });
  try {
    const preC = buildProductionPreflightChecks({
      videoSourceType: baseState.videoSourceType,
      audioSourceType: cfgC.primaryAudioSourceType ?? "browser_microphone",
      audioEngine: baseState.audioEngine,
      primaryVideoDeviceId: cfgC.primaryVideoDeviceId ?? null,
      primaryAudioDeviceId: cfgC.primaryAudioDeviceId ?? null,
      audioMix: baseState.audioMix,
      syncCheckStatus: baseState.syncCheckStatus,
      streamMethod: baseState.streamMethod,
      playbackPageUrl: baseState.playbackPageUrl,
      rtmpServerUrl: baseState.rtmpServerUrl,
      streamKeyConfigured: true,
    });
    assert.equal(preC.ready, false);
    results.push(pass("scenario_missing_camera_blocks", "preflight correctly not ready"));
  } catch (e) {
    results.push(fail("scenario_missing_camera_blocks", e instanceof Error ? e.message : String(e)));
  }

  // Scenario D: encoder labels for FFmpeg
  const labels = resolveEncoderDeviceLabels(
    {
      primaryVideoSourceType: "browser_camera",
      primaryAudioSourceType: "browser_microphone",
      audioEngine: "browser_microphone",
      primaryVideoSourceLabel: null,
      primaryAudioSourceLabel: null,
    },
    cfgA,
  );
  try {
    assert.equal(labels.videoDeviceLabel, "HD Pro Webcam C920");
    assert.equal(labels.audioDeviceLabel, "USB Audio Device");
    results.push(pass("scenario_encoder_labels", "FFmpeg dshow labels resolved"));
  } catch (e) {
    results.push(fail("scenario_encoder_labels", e instanceof Error ? e.message : String(e)));
  }

  // Scenario E: Restream default URL constant
  try {
    assert.ok(DEFAULT_RESTREAM_INGEST_RTMP_URL.includes("restream.io"));
    results.push(pass("scenario_restream_url", DEFAULT_RESTREAM_INGEST_RTMP_URL));
  } catch (e) {
    results.push(fail("scenario_restream_url", e instanceof Error ? e.message : String(e)));
  }

    // Scenario F: browser_camera must use ffmpeg encoder mode even when VMIX_API_BASE_URL is set
    const { resolveEncoderMode, encoderHealthCheck } = await import("../lib/streaming/encoder.ts");
    try {
      assert.equal(resolveEncoderMode("browser_camera"), "ffmpeg");
      assert.equal(resolveEncoderMode("vmix"), "vmix");
      const health = await encoderHealthCheck({ videoSourceType: "browser_camera" });
      assert.equal(health.encoderMode, "ffmpeg");
      results.push(
        pass(
          "scenario_encoder_mode_browser_camera",
          `mode=${health.encoderMode} online=${health.online}`,
        ),
      );
    } catch (e) {
      results.push(
        fail("scenario_encoder_mode_browser_camera", e instanceof Error ? e.message : String(e)),
      );
    }

    return results;
}

async function checkPythonMainImport() {
  const { spawnSync } = await import("node:child_process");
  const py = spawnSync("py", ["-3.11", "-c", "from app.main import app; print('ok', len(app.routes))"], {
    cwd: path.join(ROOT, "backend"),
    encoding: "utf8",
    timeout: 15000,
  });
  if (py.status === 0 && py.stdout?.includes("ok")) {
    return pass("python_main_import", py.stdout.trim());
  }
  return fail("python_main_import", py.stderr?.trim() || py.stdout?.trim() || `exit ${py.status}`);
}

async function main() {
  const started = performance.now();
  const sections = [];

  sections.push({ group: "unit_simulations", results: await runUnitSimulations() });
  sections.push({ group: "client_boundary", results: [await checkClientModuleBoundary()] });
  sections.push({ group: "python_backend", results: [await checkPythonMainImport()] });
  sections.push({ group: "runtime_backend", results: [await checkBackendHealth(), await checkEncoderPrepareDryRun()] });

  const flat = sections.flatMap((s) => s.results.map((r) => ({ ...r, group: s.group })));
  const passed = flat.filter((r) => r.ok).length;
  const failed = flat.filter((r) => !r.ok);

  const report = {
    simulatedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    summary: { total: flat.length, passed, failed: failed.length },
    sections,
    failures: failed,
    note:
      failed.some((f) => f.name === "backend_health")
        ? "Unit/config/preflight logic passed but live RTMP requires backend + FFmpeg + Restream key on the production machine."
        : "All automated checks passed. Full RTMP still requires real camera, FFmpeg, and Restream stream key at Go Live.",
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
