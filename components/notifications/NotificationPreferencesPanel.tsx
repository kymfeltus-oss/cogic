"use client";

import { useCallback, useEffect, useState } from "react";
import {
  disableDevicePush,
  enableDevicePush,
  pushSupported,
} from "@/lib/push/client";
import type { NotificationPreferences } from "@/lib/push/types";

type DeviceRow = {
  id: string;
  enabled: boolean;
  userAgent: string | null;
  lastSeenAt: string;
};

export default function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "";
      if (pushSupported()) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        endpoint = subscription?.endpoint ?? "";
      }
      const response = await fetch(
        `/api/push/preferences${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ""}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) throw new Error("Unable to load notification preferences.");
      const data = (await response.json()) as {
        preferences: NotificationPreferences;
        deviceEnabled?: boolean;
        devices?: DeviceRow[];
        scheduleRemindersNote?: string;
      };
      setPrefs(data.preferences);
      setDeviceEnabled(data.deviceEnabled === true);
      setDevices(data.devices ?? []);
      setNote(data.scheduleRemindersNote ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load preferences.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(next: Partial<NotificationPreferences>) {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/push/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await response.json()) as {
        preferences?: NotificationPreferences;
        error?: string;
        scheduleRemindersNote?: string;
      };
      if (!response.ok || !data.preferences) {
        throw new Error(data.error || "Unable to save preferences.");
      }
      setPrefs(data.preferences);
      if (data.scheduleRemindersNote) setNote(data.scheduleRemindersNote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDevice() {
    setSaving(true);
    setError(null);
    try {
      if (deviceEnabled) {
        const result = await disableDevicePush();
        if (!result.ok) throw new Error(result.error || "Unable to disable device.");
      } else {
        const result = await enableDevicePush();
        if (!result.ok) throw new Error(result.error || "Unable to enable device.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update device.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-brand-muted">Loading notification settings…</p>;
  }

  if (!prefs) {
    return (
      <p role="alert" className="text-sm text-red-200">
        {error || "Notification settings unavailable."}
      </p>
    );
  }

  const toggles: Array<{
    key: keyof NotificationPreferences;
    label: string;
    blocked?: boolean;
  }> = [
    { key: "masterEnabled", label: "Master Notifications" },
    { key: "liveBroadcasts", label: "Live Broadcasts" },
    { key: "announcements", label: "Announcements & Updates" },
    { key: "importantAlerts", label: "Important / Urgent Alerts" },
    { key: "scheduleReminders", label: "Schedule Reminders", blocked: true },
  ];

  return (
    <section className="space-y-4" aria-labelledby="notification-prefs-heading">
      <div>
        <p className="font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-blue">
          Notifications
        </p>
        <h3
          id="notification-prefs-heading"
          className="mt-1 font-headline text-lg uppercase tracking-[0.1em] text-white"
        >
          Alert preferences
        </h3>
      </div>

      <div className="space-y-2">
        {toggles.map((item) => (
          <label
            key={item.key}
            className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-black/50 px-3 py-2 text-sm text-white"
          >
            <span>
              {item.label}
              {item.blocked ? (
                <span className="mt-0.5 block text-[0.68rem] text-brand-muted">
                  Blocked — scheduling infrastructure not available
                </span>
              ) : null}
            </span>
            <input
              type="checkbox"
              checked={prefs[item.key]}
              disabled={saving || item.blocked}
              onChange={(e) => void patch({ [item.key]: e.target.checked })}
            />
          </label>
        ))}
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-black/50 px-3 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/70">
          Device notifications
        </p>
        <p className="mt-1 text-sm text-white">
          {pushSupported()
            ? deviceEnabled
              ? "Enabled on this device"
              : "Disabled on this device"
            : "Not supported in this browser"}
        </p>
        {pushSupported() ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void toggleDevice()}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-blue/40 bg-brand-blue/10 px-4 font-ui text-[0.62rem] font-bold uppercase tracking-[0.1em] text-white disabled:opacity-50"
          >
            {deviceEnabled ? "Disable on this device" : "Enable on this device"}
          </button>
        ) : null}
        {devices.length > 1 ? (
          <p className="mt-2 text-[0.7rem] text-brand-muted">
            {devices.filter((d) => d.enabled).length} active device
            {devices.filter((d) => d.enabled).length === 1 ? "" : "s"} on this account
          </p>
        ) : null}
      </div>

      {note ? <p className="text-[0.7rem] text-brand-muted">{note}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
