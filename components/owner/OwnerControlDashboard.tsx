"use client";

import Link from "next/link";
import type {
  OwnerBroadcastSnapshot,
  PreflightCheck,
  PreflightCheckStatus,
} from "@/lib/owner/contracts";
import ProductionSourceAssignments from "@/components/owner/ProductionSourceAssignments";

type OwnerControlDashboardProps = {
  snapshot: OwnerBroadcastSnapshot;
  loading?: boolean;
  error?: string | null;
  actionMessage?: string | null;
  actionPending?: boolean;
  onRefresh?: () => void;
  onPreflight?: (mode: "external_hls" | "rtmp_encoder" | "browser_camera") => void;
  onGoLive?: (mode: "external_hls" | "rtmp_encoder" | "browser_camera") => void;
  onEnd?: () => void;
  onVmixCommand?: (functionName: string) => void;
  onSwitchFeed?: (source: "primary" | "backup") => void;
};

const STATUS_COLORS: Record<string, string> = {
  idle: "text-white/60",
  scheduled: "text-brand-blue",
  preshow: "text-amber-300",
  live: "text-emerald-400",
  ended: "text-white/50",
  offline: "text-white/60",
  preflight: "text-amber-300",
  starting: "text-amber-300",
  publishing: "text-emerald-400",
  ending: "text-amber-300",
  error: "text-red-400",
  unconfigured: "text-white/50",
  ready: "text-brand-blue",
  playback_pending: "text-amber-300",
};

function StatusBadge({ label, value }: { label: string; value: string }) {
  const color = STATUS_COLORS[value] ?? "text-white/70";
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="font-ui text-[0.58rem] font-bold uppercase tracking-[0.18em] text-white/45">
        {label}
      </p>
      <p className={`mt-1 font-ui text-sm font-bold uppercase tracking-[0.12em] ${color}`}>
        {value.replace(/_/g, " ")}
      </p>
    </div>
  );
}

function PreflightRow({ check }: { check: PreflightCheck }) {
  const tone: Record<PreflightCheckStatus, string> = {
    pass: "text-emerald-400",
    warn: "text-amber-300",
    fail: "text-red-400",
    skipped: "text-white/40",
  };

  return (
    <li className="flex items-start justify-between gap-3 border-b border-white/5 py-2 last:border-0">
      <div>
        <p className="font-body text-sm text-white/85">{check.label}</p>
        <p className="mt-0.5 font-ui text-[0.52rem] uppercase tracking-[0.12em] text-white/35">
          {check.required ? "Required" : "Optional"}
        </p>
        {check.detail ? (
          <p className="mt-0.5 font-body text-xs text-white/45">{check.detail}</p>
        ) : null}
      </div>
      <span className={`font-ui text-[0.62rem] font-bold uppercase tracking-[0.14em] ${tone[check.status]}`}>
        {check.status}
      </span>
    </li>
  );
}

function LaneHealthCard({
  title,
  subtitle,
  lane,
  isActive,
}: {
  title: string;
  subtitle: string;
  lane: OwnerBroadcastSnapshot["feed"]["primary"];
  isActive: boolean;
}) {
  const ingestTone = lane.manifestReachable
    ? "text-emerald-400"
    : lane.hlsUrl
      ? "text-amber-300"
      : "text-white/50";

  return (
    <div
      className={`rounded-lg border p-4 ${
        isActive ? "border-brand-blue/50 bg-brand-blue/[0.06]" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/70">
            {title}
          </h3>
          <p className="mt-1 font-body text-xs text-white/45">{subtitle}</p>
        </div>
        {isActive ? (
          <span className="rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 font-ui text-[0.55rem] font-bold uppercase tracking-[0.12em] text-red-300">
            On Air
          </span>
        ) : null}
      </div>
      <dl className="mt-3 grid gap-2 font-body text-sm sm:grid-cols-2">
        <div>
          <dt className="text-white/50">Manifest</dt>
          <dd className={ingestTone}>
            {lane.manifestReachable ? "200 OK" : lane.hlsUrl ? "Unreachable" : "Not configured"}
          </dd>
        </div>
        <div>
          <dt className="text-white/50">HLS URL</dt>
          <dd className="text-white/85">{lane.hlsUrl ? "Configured" : "Missing"}</dd>
        </div>
      </dl>
      {lane.detail && !lane.manifestReachable ? (
        <p className="mt-2 font-body text-xs text-amber-300/80">{lane.detail}</p>
      ) : null}
    </div>
  );
}

export default function OwnerControlDashboard({
  snapshot,
  loading = false,
  error = null,
  actionMessage = null,
  actionPending = false,
  onRefresh,
  onPreflight,
  onGoLive,
  onEnd,
  onVmixCommand,
  onSwitchFeed,
}: OwnerControlDashboardProps) {
  const isLive =
    snapshot.playback.status === "live" ||
    snapshot.playback.status === "playback_pending" ||
    snapshot.publish.status === "publishing";

  const activeFeed = snapshot.feed.activeSource;
  const canFailover = isLive && snapshot.publish.mode !== "browser_camera";

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 p-4 sm:p-6">
        <header className="border-b border-white/10 pb-4">
          <p className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.22em] text-brand-blue">
            Owner Control
          </p>
          <h1 className="font-headline text-2xl uppercase tracking-[0.08em]">Broadcast Console</h1>
          <p className="mt-2 font-body text-sm text-white/55">
            Event phase, publish pipeline, and playback are shown separately — never one combined live flag.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-body text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {actionMessage ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 font-body text-sm text-white/80">
            {actionMessage}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-3">
          <StatusBadge label="Event phase (schedule)" value={snapshot.eventPhase.phase} />
          <StatusBadge label="Publish status" value={snapshot.publish.status} />
          <StatusBadge label="Playback status" value={snapshot.playback.status} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h2 className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-white/45">
              Publish
            </h2>
            <dl className="mt-3 space-y-2 font-body text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-white/50">Mode</dt>
                <dd className="text-white/85">{snapshot.publish.mode}</dd>
              </div>
              {snapshot.publish.errorMessage ? (
                <div className="text-red-300">{snapshot.publish.errorMessage}</div>
              ) : null}
            </dl>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h2 className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-white/45">
              Playback
            </h2>
            <dl className="mt-3 space-y-2 font-body text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-white/50">HLS configured</dt>
                <dd className="text-white/85">{snapshot.playback.hlsUrl ? "Yes" : "No"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/50">Manifest reachable</dt>
                <dd className="text-white/85">
                  {snapshot.playback.manifestReachable ? "Yes" : "No"}
                </dd>
              </div>
              {snapshot.playback.hlsUrl ? (
                <p className="break-all text-xs text-white/40">{snapshot.playback.hlsUrl}</p>
              ) : null}
            </dl>
          </div>
        </section>

        <section className="rounded-lg border border-white/15 bg-white/[0.02] p-4">
          <h2 className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-blue">
            Production Sources
          </h2>
          <p className="mt-2 font-body text-xs text-white/45">
            Provider-aware primary contribution with an optional real backup. Playback and ingest credentials remain separate.
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <LaneHealthCard
              title={`Primary — ${snapshot.feed.primary.provider === "ivs" ? "Amazon IVS" : snapshot.feed.primary.provider}`}
              subtitle="Professional production crew program feed"
              lane={snapshot.feed.primary}
              isActive={activeFeed === "primary"}
            />
            <LaneHealthCard
              title={`Backup — ${snapshot.feed.backup.hlsUrl ? snapshot.feed.backup.provider : "Unconfigured"}`}
              subtitle="Optional approved production backup"
              lane={snapshot.feed.backup}
              isActive={activeFeed === "backup"}
            />
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-black/40 p-4">
            <p className="font-ui text-[0.58rem] font-bold uppercase tracking-[0.16em] text-white/50">
              Master Broadcast Routing
            </p>
            <p className="mt-2 font-body text-sm text-white/80">
              Current route:{" "}
              <span className="font-semibold text-white">
                {activeFeed === "backup"
                  ? "Backup source"
                  : activeFeed === "primary"
                    ? `Primary — ${snapshot.feed.primary.provider === "ivs" ? "Amazon IVS" : snapshot.feed.primary.provider}`
                    : "Offline"}
              </span>
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={actionPending || !canFailover || activeFeed === "primary"}
                onClick={() => onSwitchFeed?.("primary")}
                className="min-h-11 rounded-full border border-white/20 px-5 font-ui text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white disabled:opacity-40"
              >
                Use Primary
              </button>
              <button
                type="button"
                disabled={
                  actionPending ||
                  !canFailover ||
                  activeFeed === "backup" ||
                  !snapshot.feed.backup.hlsUrl
                }
                onClick={() => onSwitchFeed?.("backup")}
                className="min-h-11 rounded-full border border-red-400/50 bg-red-500/10 px-5 font-ui text-[0.65rem] font-bold uppercase tracking-[0.12em] text-red-200 disabled:opacity-40"
              >
                Use Backup
              </button>
            </div>
            {!isLive ? (
              <p className="mt-3 font-body text-xs text-white/35">
                Go live on primary first. Failover switches attendee HLS without ending the show.
              </p>
            ) : null}
          </div>
        </section>

        <ProductionSourceAssignments />

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-blue">
            Broadcast Crew Connection
          </h2>
          <p className="mt-2 font-body text-xs text-white/45">
            Safe status only. Stream keys, passphrases, and ingest endpoints are distributed manually by an authorized operator.
          </p>
          <dl className="mt-4 grid gap-3 font-body text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-white/50">Primary source</dt><dd className="text-white/85">{snapshot.ingest.provider === "ivs" ? "Amazon IVS" : snapshot.ingest.provider}</dd></div>
            <div><dt className="text-white/50">Ingest</dt><dd className={snapshot.ingest.ingestConfigured ? "text-emerald-400" : "text-amber-300"}>{snapshot.ingest.ingestConfigured ? `${snapshot.ingest.protocol.toUpperCase()} configured` : "Not configured"}</dd></div>
            <div><dt className="text-white/50">Playback</dt><dd className={snapshot.ingest.playbackConfigured ? "text-emerald-400" : "text-red-400"}>{snapshot.ingest.playbackConfigured ? "Configured" : "Not configured"}</dd></div>
            <div><dt className="text-white/50">Stream</dt><dd className={isLive ? "text-emerald-400" : "text-white/65"}>{isLive ? "Live" : "Offline"}</dd></div>
            <div><dt className="text-white/50">Recording configured</dt><dd className="text-white/85">{snapshot.ingest.recordingConfigured ? "Yes" : "No"}</dd></div>
            <div><dt className="text-white/50">Recording active</dt><dd className="text-white/85">{snapshot.ingest.recordingActive ? "Yes" : "No"}</dd></div>
            <div><dt className="text-white/50">Backup</dt><dd className="text-white/85">{snapshot.ingest.backupConfigured ? "Configured" : "Unconfigured"}</dd></div>
            <div><dt className="text-white/50">Crew connection</dt><dd className={snapshot.ingest.crewConnectionReady ? "text-emerald-400" : "text-amber-300"}>{snapshot.ingest.crewConnectionReady ? "Ready" : "Needs operator setup"}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-white/45">
            Schedule
          </h2>
          <dl className="mt-3 grid gap-2 font-body text-sm sm:grid-cols-2">
            <div>
              <dt className="text-white/50">Start</dt>
              <dd className="text-white/85">{snapshot.eventPhase.startTime ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-white/50">End</dt>
              <dd className="text-white/85">{snapshot.eventPhase.endTime ?? "—"}</dd>
            </div>
          </dl>
        </section>

        {snapshot.vmix ? (
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h2 className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-white/45">
              vMix Production
            </h2>
            <dl className="mt-3 grid gap-2 font-body text-sm sm:grid-cols-2">
              <div>
                <dt className="text-white/50">Connection</dt>
                <dd className="text-white/85">{snapshot.vmix.connection}</dd>
              </div>
              <div>
                <dt className="text-white/50">Version</dt>
                <dd className="text-white/85">{snapshot.vmix.version ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-white/50">Streaming</dt>
                <dd className={snapshot.vmix.streaming ? "text-emerald-400" : "text-white/85"}>
                  {snapshot.vmix.streaming ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-white/50">Recording</dt>
                <dd className="text-white/85">{snapshot.vmix.recording ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-white/50">Active input</dt>
                <dd className="text-white/85">{snapshot.vmix.activeInput ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-white/50">Preview input</dt>
                <dd className="text-white/85">{snapshot.vmix.previewInput ?? "—"}</dd>
              </div>
            </dl>
            {snapshot.vmix.message ? (
              <p className="mt-3 font-body text-xs text-white/50">{snapshot.vmix.message}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actionPending || !snapshot.vmix.configured}
                onClick={() => onVmixCommand?.("StartStreaming")}
                className="min-h-10 rounded-full border border-white/15 px-4 font-ui text-[0.62rem] font-bold uppercase tracking-[0.12em] text-white disabled:opacity-50"
              >
                vMix Start Stream
              </button>
              <button
                type="button"
                disabled={actionPending || !snapshot.vmix.configured}
                onClick={() => onVmixCommand?.("StopStreaming")}
                className="min-h-10 rounded-full border border-red-400/30 px-4 font-ui text-[0.62rem] font-bold uppercase tracking-[0.12em] text-red-300 disabled:opacity-50"
              >
                vMix Stop Stream
              </button>
            </div>
            <p className="mt-3 font-body text-xs text-white/35">
              vMix is optional. When explicitly enabled, this panel monitors it and sends start/stop commands;
              Amazon IVS accepts approved professional encoders directly.
            </p>
          </section>
        ) : null}

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-white/45">
            Preflight
          </h2>
          <ul className="mt-3">
            {snapshot.preflight.map((check) => (
              <PreflightRow key={check.id} check={check} />
            ))}
          </ul>
        </section>

        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={actionPending}
            onClick={() => onRefresh?.()}
            className="min-h-11 rounded-full border border-white/15 px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            disabled={actionPending}
            onClick={() => onPreflight?.("external_hls")}
            className="min-h-11 rounded-full border border-white/15 px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            Preflight HLS
          </button>
          <button
            type="button"
            disabled={actionPending}
            onClick={() => onGoLive?.("external_hls")}
            className="min-h-11 rounded-full bg-brand-blue px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-black disabled:opacity-50"
          >
            Go Live (HLS)
          </button>
          <button
            type="button"
            disabled={actionPending}
            onClick={() => onGoLive?.("rtmp_encoder")}
            className="min-h-11 rounded-full bg-brand-blue/80 px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-black disabled:opacity-50"
          >
            Go Live (RTMP)
          </button>
          <button
            type="button"
            disabled={actionPending}
            onClick={() => onGoLive?.("browser_camera")}
            className="min-h-11 rounded-full bg-white px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-black disabled:opacity-50"
          >
            Go Live (Camera)
          </button>
          <button
            type="button"
            disabled={actionPending || !isLive}
            onClick={() => onEnd?.()}
            className="min-h-11 rounded-full border border-red-400/40 px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-red-300 disabled:opacity-50"
          >
            End Broadcast
          </button>
          <Link
            href="/owner/publish/camera"
            className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white"
          >
            Camera Publisher
          </Link>
        </section>

        <footer className="pb-6 font-body text-xs text-white/35">
          {snapshot.capturedAt
            ? `Snapshot captured ${new Date(snapshot.capturedAt).toLocaleString()}`
            : "Awaiting snapshot…"}
          {snapshot.publisherChannel ? ` · Signaling ${snapshot.publisherChannel}` : ""}
        </footer>
      </div>
    </main>
  );
}
