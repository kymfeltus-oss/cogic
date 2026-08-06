"use client";

import { useCallback, useEffect, useState } from "react";
import OwnerControlDashboard from "@/components/owner/OwnerControlDashboard";
import type { OwnerBroadcastSnapshot } from "@/lib/owner/contracts";
import { defaultEventPhaseState } from "@/lib/owner/map-event-phase";

const POLL_MS = 4_000;

const EMPTY_SNAPSHOT: OwnerBroadcastSnapshot = {
  capturedAt: "",
  eventPhase: defaultEventPhaseState(),
  publish: { mode: "none", status: "offline", errorMessage: null },
  playback: {
    status: "unconfigured",
    hlsUrl: null,
    manifestReachable: false,
    errorMessage: null,
  },
  feed: {
    activeSource: "offline",
    primary: { provider: "external", hlsUrl: null, manifestReachable: false, detail: null },
    backup: { provider: "external", hlsUrl: null, manifestReachable: false, detail: null },
  },
  ingest: {
    provider: "external",
    protocol: "unconfigured",
    ingestConfigured: false,
    playbackConfigured: false,
    channelConfigured: false,
    recordingConfigured: false,
    recordingActive: false,
    backupConfigured: false,
    crewConnectionReady: false,
  },
  preflight: [],
  publisherSessionId: null,
  publisherChannel: null,
  vmix: null,
};

type BroadcastResponse = {
  snapshot?: OwnerBroadcastSnapshot;
  error?: string;
  message?: string;
  ok?: boolean;
  blocked?: boolean;
};

export default function OwnerControlClient() {
  const [snapshot, setSnapshot] = useState<OwnerBroadcastSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const loadSnapshot = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/owner/broadcast", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        setError("Owner access denied. Sign in with an ADMIN_EMAILS account.");
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load broadcast snapshot.");
      }

      const data = (await response.json()) as BroadcastResponse;
      if (data.snapshot) setSnapshot(data.snapshot);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Load failed.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialId = window.setTimeout(() => void loadSnapshot(), 0);
    const intervalId = window.setInterval(() => void loadSnapshot(true), POLL_MS);
    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(intervalId);
    };
  }, [loadSnapshot]);

  const runPreflight = useCallback(
    async (mode: "external_hls" | "rtmp_encoder" | "browser_camera") => {
      setActionPending(true);
      setActionMessage(null);
      try {
        const response = await fetch("/api/owner/broadcast/preflight", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const data = (await response.json()) as BroadcastResponse;
        if (data.snapshot) setSnapshot(data.snapshot);
        setActionMessage(
          data.blocked ? "Preflight has blockers — review checks above." : "Preflight complete.",
        );
      } catch {
        setActionMessage("Preflight request failed.");
      } finally {
        setActionPending(false);
      }
    },
    [],
  );

  const runGoLive = useCallback(
    async (mode: "external_hls" | "rtmp_encoder" | "browser_camera") => {
      setActionPending(true);
      setActionMessage(null);
      try {
        const response = await fetch("/api/owner/broadcast/go-live", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, confirm: true }),
        });
        const data = (await response.json()) as BroadcastResponse;
        if (data.snapshot) setSnapshot(data.snapshot);
        setActionMessage(data.message ?? (data.ok ? "Go-live succeeded." : "Go-live blocked."));
      } catch {
        setActionMessage("Go-live request failed.");
      } finally {
        setActionPending(false);
      }
    },
    [],
  );

  const runEnd = useCallback(async () => {
    setActionPending(true);
    setActionMessage(null);
    try {
      const response = await fetch("/api/owner/broadcast/end", {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json()) as BroadcastResponse;
      if (data.snapshot) setSnapshot(data.snapshot);
      setActionMessage(data.message ?? (data.ok ? "Broadcast ended." : "End blocked."));
    } catch {
      setActionMessage("End broadcast request failed.");
    } finally {
      setActionPending(false);
    }
  }, []);

  const runVmixCommand = useCallback(async (functionName: string) => {
    setActionPending(true);
    setActionMessage(null);
    try {
      const response = await fetch("/api/owner/vmix/command", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: functionName }),
      });
      const data = (await response.json()) as {
        vmix?: OwnerBroadcastSnapshot["vmix"];
        message?: string;
        ok?: boolean;
        error?: string;
      };
      if (data.vmix) {
        setSnapshot((prev) => ({ ...prev, vmix: data.vmix ?? prev.vmix }));
      } else {
        await loadSnapshot(true);
      }
      setActionMessage(
        data.message ?? data.error ?? (data.ok ? `${functionName} sent.` : "vMix command failed."),
      );
    } catch {
      setActionMessage("vMix command request failed.");
    } finally {
      setActionPending(false);
    }
  }, [loadSnapshot]);

  const runSwitchFeed = useCallback(async (source: "primary" | "backup") => {
    setActionPending(true);
    setActionMessage(null);
    try {
      const response = await fetch("/api/owner/broadcast/switch-feed", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, confirm: true }),
      });
      const data = (await response.json()) as BroadcastResponse;
      if (data.snapshot) setSnapshot(data.snapshot);
      setActionMessage(data.message ?? (data.ok ? "Feed switched." : "Feed switch blocked."));
    } catch {
      setActionMessage("Feed switch request failed.");
    } finally {
      setActionPending(false);
    }
  }, []);

  return (
    <OwnerControlDashboard
      snapshot={snapshot}
      loading={loading}
      error={error}
      actionMessage={actionMessage}
      actionPending={actionPending}
      onRefresh={() => void loadSnapshot()}
      onPreflight={(mode) => void runPreflight(mode)}
      onGoLive={(mode) => void runGoLive(mode)}
      onEnd={() => void runEnd()}
      onVmixCommand={(fn) => void runVmixCommand(fn)}
      onSwitchFeed={(source) => void runSwitchFeed(source)}
    />
  );
}
