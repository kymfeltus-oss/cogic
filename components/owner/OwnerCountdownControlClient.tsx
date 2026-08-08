"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, Check, Clock3, Copy, ExternalLink, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import HoldingRoomCountdownOverlay from "@/components/experience/holding-room/HoldingRoomCountdownOverlay";
import {
  HOLDING_ROOM_ART_NATIVE,
} from "@/lib/experience/holding-room-assets";
import {
  MOBILE_ARTBOARD_FULL_SHELL,
  mobileArtboardStageStyle,
} from "@/lib/responsive";
import type { ShowSetupState } from "@/lib/owner/show-setup-state";
import {
  isoToScheduleDatetimeLocal,
  scheduleDatetimeLocalToIso,
  type ScheduleTimezone,
} from "@/lib/live/schedule-timezone";
import {
  DEFAULT_COUNTDOWN_CONFIG,
  type EventCountdownConfig,
} from "@/lib/live/countdown-config";

const EVENT_NAME = "COGIC LIVE";
const PRESENTER_NAME = "COGIC LIVE";
const EVENT_START_ISO = "2026-07-03T19:30:00-05:00";
const EVENT_TIMEZONE: ScheduleTimezone = "America/Chicago";
const EVENT_LOCATION = "New Orleans, LA";
const LIVESTREAM_AVAILABILITY = "Available worldwide";

type ShowSetupResponse = {
  state?: ShowSetupState;
  message?: string;
  error?: string;
};

type CountdownResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

function countdownParts(targetIso: string, nowMs: number) {
  const remaining = Math.max(0, new Date(targetIso).getTime() - nowMs);
  const totalSeconds = Math.floor(remaining / 1_000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isComplete: remaining === 0,
  };
}

function buildPreviewEndIso(startIso: string): string {
  const startMs = new Date(startIso).getTime();
  if (Number.isNaN(startMs)) return DEFAULT_COUNTDOWN_CONFIG.end_time;
  return new Date(startMs + 4 * 60 * 60 * 1_000).toISOString();
}

export default function OwnerCountdownControlClient() {
  const [setup, setSetup] = useState<ShowSetupState | null>(null);
  const [eventName, setEventName] = useState(EVENT_NAME);
  const [presenterName, setPresenterName] = useState(PRESENTER_NAME);
  const [eventLocation, setEventLocation] = useState(EVENT_LOCATION);
  const [livestreamAvailability, setLivestreamAvailability] = useState(LIVESTREAM_AVAILABILITY);
  const [hostNames, setHostNames] = useState<string[]>([""]);
  const timezone = EVENT_TIMEZONE;
  const [dateTimeLocal, setDateTimeLocal] = useState(
    isoToScheduleDatetimeLocal(EVENT_START_ISO, EVENT_TIMEZONE),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Loading the live event schedule...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  const targetIso = useMemo(
    () => scheduleDatetimeLocalToIso(dateTimeLocal, timezone) ?? EVENT_START_ISO,
    [dateTimeLocal, timezone],
  );
  const countdown = useMemo(() => countdownParts(targetIso, nowMs), [nowMs, targetIso]);
  const loadSetup = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/owner/show-setup", { credentials: "include", cache: "no-store" });
      const data = (await response.json()) as ShowSetupResponse;
      if (!response.ok || !data.state) throw new Error(data.error ?? "Unable to load countdown setup.");

      const savedDate = new Date(data.state.targetDateTime).getTime();
      const useEventDefault = !Number.isFinite(savedDate) || savedDate < Date.now();
      const nextIso = useEventDefault ? EVENT_START_ISO : data.state.targetDateTime;
      setSetup(data.state);
      setEventName(
        !data.state.showTitle ||
        data.state.showTitle === "The Awakening Experience" ||
        data.state.showTitle === "IAN CRAIG & 300"
          ? EVENT_NAME
          : data.state.showTitle,
      );
      setPresenterName(
        !data.state.presenterName || data.state.presenterName === "Pastor David Jenkins"
          ? PRESENTER_NAME
          : data.state.presenterName,
      );
      setHostNames(data.state.hostNames.length ? data.state.hostNames : [""]);
      setEventLocation(data.state.eventLocation || EVENT_LOCATION);
      setLivestreamAvailability(data.state.livestreamAvailability || LIVESTREAM_AVAILABILITY);
      setDateTimeLocal(isoToScheduleDatetimeLocal(nextIso, EVENT_TIMEZONE));
      setTone("success");
      setMessage(useEventDefault ? "July 3 event details preloaded. Save to publish the schedule." : "Countdown schedule loaded.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Countdown setup failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadSetup());
  }, [loadSetup]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const saveSchedule = useCallback(async () => {
    if (!setup || pending) return;
    const parsedIso = scheduleDatetimeLocalToIso(dateTimeLocal, timezone);
    if (!parsedIso) {
      setTone("error");
      setMessage("Choose a valid event date and time.");
      return;
    }

    setPending(true);
    setTone("info");
    setMessage("Publishing countdown schedule...");
    try {
      const response = await fetch("/api/owner/show-setup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...setup,
          showTitle: eventName,
          presenterName,
          eventLocation,
          livestreamAvailability,
          hostNames: hostNames.map((host) => host.trim()).filter(Boolean),
          targetDateTime: parsedIso,
        }),
      });
      const data = (await response.json()) as ShowSetupResponse;
      if (!response.ok || !data.state) throw new Error(data.error ?? "Unable to save countdown schedule.");
      setSetup(data.state);
      setTone("success");
      setMessage(data.message ?? "Countdown schedule is live across the app.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Countdown schedule failed to save.");
    } finally {
      setPending(false);
    }
  }, [
    dateTimeLocal,
    eventLocation,
    eventName,
    hostNames,
    livestreamAvailability,
    pending,
    presenterName,
    setup,
    timezone,
  ]);

  const adjustTimer = useCallback(
    async (offsetSeconds: number) => {
      if (pending) return;
      setPending(true);
      setTone("info");
      setMessage("Adjusting countdown...");
      try {
        const response = await fetch("/api/owner/countdown", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offsetSeconds }),
        });
        const data = (await response.json()) as CountdownResponse;
        if (!response.ok) throw new Error(data.error ?? "Countdown adjustment failed.");
        await loadSetup();
        setTone("success");
        setMessage(data.message ?? "Countdown adjusted.");
      } catch (error) {
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Countdown adjustment failed.");
      } finally {
        setPending(false);
      }
    },
    [loadSetup, pending],
  );

  const resetDefaults = () => {
    setEventName(EVENT_NAME);
    setPresenterName(PRESENTER_NAME);
    setEventLocation(EVENT_LOCATION);
    setLivestreamAvailability(LIVESTREAM_AVAILABILITY);
    setHostNames([""]);
    setDateTimeLocal(isoToScheduleDatetimeLocal(EVENT_START_ISO, EVENT_TIMEZONE));
    setTone("info");
    setMessage("Event defaults restored in the editor. Save to publish them.");
  };

  const copyOverlay = async () => {
    const url = `${window.location.origin}/countdown/obs`;
    await navigator.clipboard.writeText(url);
    setTone("success");
    setMessage("OBS/Restream countdown overlay URL copied.");
  };

  const simulatedConfig = useMemo<EventCountdownConfig>(() => {
    return {
      ...DEFAULT_COUNTDOWN_CONFIG,
      headline: eventName.trim() || DEFAULT_COUNTDOWN_CONFIG.headline,
      subtitle: presenterName.trim() || DEFAULT_COUNTDOWN_CONFIG.subtitle,
      start_time: targetIso,
      end_time: buildPreviewEndIso(targetIso),
      schedule_timezone: timezone,
    };
  }, [eventName, presenterName, targetIso, timezone]);

  return (
    <main className="min-h-screen bg-[#030611] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <Link href="/owner/cockpit" className="inline-flex items-center gap-2 font-ui text-xs uppercase tracking-[0.16em] text-[#00DDEB]">
              <ArrowLeft className="h-4 w-4" /> Production Cockpit
            </Link>
            <h1 className="mt-3 font-headline text-3xl uppercase tracking-[0.08em] sm:text-4xl">Countdown Control</h1>
            <p className="mt-2 font-body text-sm text-white/55">One schedule for the app, attendee lobby, OBS, and Restream.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/countdown" target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 font-ui text-xs uppercase">
              Public Preview <ExternalLink className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => void copyOverlay()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#00DDEB]/45 px-4 font-ui text-xs uppercase text-[#00DDEB]">
              Overlay URL <Copy className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-[#D853FF]/45 bg-[#09091A]/90 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-ui text-xs uppercase tracking-[0.18em] text-[#D853FF]">Event schedule</p>
                <h2 className="mt-2 font-headline text-2xl uppercase">Published everywhere</h2>
              </div>
              <Clock3 className="h-8 w-8 text-[#00DDEB]" />
            </div>

            <label className="mt-6 block">
              <span className="font-ui text-xs uppercase tracking-[0.14em] text-white/60">Event name</span>
              <input value={eventName} onChange={(event) => setEventName(event.target.value)} disabled={loading || pending} className="mt-2 min-h-12 w-full rounded-lg border border-white/15 bg-[#050816] px-4 font-body text-white outline-none focus:border-[#00DDEB]" />
            </label>
            <label className="mt-4 block">
              <span className="font-ui text-xs uppercase tracking-[0.14em] text-white/60">Artist / presenter</span>
              <input value={presenterName} onChange={(event) => setPresenterName(event.target.value)} disabled={loading || pending} className="mt-2 min-h-12 w-full rounded-lg border border-white/15 bg-[#050816] px-4 font-body text-white outline-none focus:border-[#00DDEB]" />
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="font-ui text-xs uppercase tracking-[0.14em] text-white/60">Event location</span>
                <input
                  value={eventLocation}
                  onChange={(event) => setEventLocation(event.target.value)}
                  disabled={loading || pending}
                  placeholder="New Orleans, LA"
                  maxLength={100}
                  className="mt-2 min-h-12 w-full rounded-lg border border-white/15 bg-[#050816] px-4 font-body text-white outline-none focus:border-[#00DDEB]"
                />
              </label>
              <label>
                <span className="font-ui text-xs uppercase tracking-[0.14em] text-white/60">Livestream line</span>
                <input
                  value={livestreamAvailability}
                  onChange={(event) => setLivestreamAvailability(event.target.value)}
                  disabled={loading || pending}
                  placeholder="Available worldwide"
                  maxLength={100}
                  className="mt-2 min-h-12 w-full rounded-lg border border-white/15 bg-[#050816] px-4 font-body text-white outline-none focus:border-[#00DDEB]"
                />
              </label>
            </div>
            <fieldset className="mt-4">
              <legend className="sr-only">Event host names</legend>
              <div className="flex items-center justify-between gap-3">
                <span className="font-ui text-xs uppercase tracking-[0.14em] text-white/60">
                  Event host names
                </span>
                <button
                  type="button"
                  disabled={loading || pending || hostNames.length >= 8}
                  onClick={() => setHostNames((current) => [...current, ""])}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#00DDEB]/35 px-3 font-ui text-[0.62rem] uppercase text-[#00DDEB] disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Host
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {hostNames.map((hostName, index) => (
                  <div key={`host-${index}`} className="flex gap-2">
                    <input
                      aria-label={`Host ${index + 1} name`}
                      value={hostName}
                      onChange={(event) =>
                        setHostNames((current) =>
                          current.map((host, hostIndex) =>
                            hostIndex === index ? event.target.value : host,
                          ),
                        )
                      }
                      disabled={loading || pending}
                      placeholder={`Host ${index + 1} name`}
                      maxLength={80}
                      className="min-h-12 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#050816] px-4 font-body text-white outline-none focus:border-[#00DDEB]"
                    />
                    {hostNames.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remove host ${index + 1}`}
                        disabled={loading || pending}
                        onClick={() =>
                          setHostNames((current) => current.filter((_, hostIndex) => hostIndex !== index))
                        }
                        className="flex w-12 items-center justify-center rounded-lg border border-red-400/25 text-red-300 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="mt-2 font-body text-xs text-white/35">Add up to eight hosts. Empty rows are ignored when saved.</p>
            </fieldset>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_0.8fr]">
              <label>
                <span className="font-ui text-xs uppercase tracking-[0.14em] text-white/60">Date and time</span>
                <input type="datetime-local" value={dateTimeLocal} onChange={(event) => setDateTimeLocal(event.target.value)} disabled={loading || pending} className="mt-2 min-h-12 w-full rounded-lg border border-white/15 bg-[#050816] px-4 font-body text-white outline-none focus:border-[#00DDEB]" />
              </label>
              <div>
                <span className="font-ui text-xs uppercase tracking-[0.14em] text-white/60">Timezone</span>
                <div className="mt-2 flex min-h-12 w-full items-center rounded-lg border border-white/15 bg-[#050816] px-4 font-body text-white/75">
                  Central Time (CT)
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
              {[-300, -60, 60, 300].map((offset) => (
                <button key={offset} type="button" disabled={loading || pending} onClick={() => void adjustTimer(offset)} className="min-h-10 rounded-lg border border-white/15 font-ui text-[0.65rem] uppercase text-white/75 disabled:opacity-40">
                  {offset > 0 ? "+" : ""}{offset / 60} min
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" disabled={loading || pending || !setup} onClick={() => void saveSchedule()} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#D80A86] via-[#7B3DFF] to-[#00A7FF] px-5 font-ui text-xs uppercase tracking-[0.14em] disabled:opacity-45">
                <Save className="h-4 w-4" /> {pending ? "Saving..." : "Save & Publish"}
              </button>
              <button type="button" disabled={pending} onClick={resetDefaults} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/15 px-4 font-ui text-xs uppercase text-white/65">
                <RotateCcw className="h-4 w-4" /> Defaults
              </button>
            </div>
            <p className={`mt-4 flex items-center gap-2 font-body text-sm ${tone === "error" ? "text-red-300" : tone === "success" ? "text-emerald-300" : "text-white/55"}`}>
              {tone === "success" ? <Check className="h-4 w-4" /> : null}{message}
            </p>
          </section>

          {/* DYNAMIC PUBLIC ATTENDEE HOLDING ROOM COMPOSITE ARTBOARD PREVIEW PANEL */}
          <section className="overflow-hidden rounded-2xl border border-[#00DDEB]/35 bg-black flex items-center justify-center p-4">
            <div className="live-holding-shell bg-black text-white w-full flex justify-center">
              <div className={`${MOBILE_ARTBOARD_FULL_SHELL} border border-white/10 rounded-xl overflow-hidden shadow-2xl`}>
                <div
                  className="holding-room-page__stage"
                  style={
                    mobileArtboardStageStyle({ native: HOLDING_ROOM_ART_NATIVE }) as CSSProperties
                  }
                >
                  <div className="mobile-artboard-art-fit holding-room-page__art-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/holding page/holding-room.png"
                      alt="COGIC LIVE holding room"
                      width={HOLDING_ROOM_ART_NATIVE.width}
                      height={HOLDING_ROOM_ART_NATIVE.height}
                      className="holding-room-page__bg"
                      loading="eager"
                      draggable={false}
                    />

                    <div className="absolute inset-0">
                      <HoldingRoomCountdownOverlay
                        initialCountdownConfig={simulatedConfig}
                        initialCountdown={countdown}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
