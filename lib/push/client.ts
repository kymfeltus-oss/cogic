/**
 * Browser-only Web Push helpers. Never imports private VAPID material.
 */

const SW_PATH = "/sw.js";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return navigator.serviceWorker.register(SW_PATH, { scope: "/" });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function fetchPublicVapidKey(): Promise<string | null> {
  const response = await fetch("/api/push/vapid-public-key", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { publicKey?: string | null };
  return typeof data.publicKey === "string" && data.publicKey ? data.publicKey : null;
}

export async function enableDevicePush(): Promise<{
  ok: boolean;
  error?: string;
  permission?: NotificationPermission;
}> {
  if (!pushSupported()) {
    return { ok: false, error: "This browser does not support Web Push." };
  }

  // Permission only after intentional user action (caller must be a click handler).
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, permission, error: "Notification permission was not granted." };
  }

  const publicKey = await fetchPublicVapidKey();
  if (!publicKey) {
    return { ok: false, error: "Push is not configured on the server." };
  }

  const registration = await ensureServiceWorker();
  if (!registration) {
    return { ok: false, error: "Unable to register the notification service worker." };
  }

  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    }),
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    return { ok: false, error: data.error || "Unable to save push subscription." };
  }
  return { ok: true, permission };
}

export async function disableDevicePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: true };

  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  const endpoint = subscription?.endpoint ?? null;

  if (subscription) {
    await subscription.unsubscribe().catch(() => undefined);
  }

  if (endpoint) {
    const response = await fetch("/api/push/subscribe", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error || "Unable to revoke device subscription." };
    }
  }

  return { ok: true };
}

/** Call on logout so the endpoint is not left owned by the prior user. */
export async function revokeCurrentDeviceOnLogout(): Promise<void> {
  try {
    if (!pushSupported()) return;
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    const endpoint = subscription?.endpoint;
    if (!endpoint) return;

    await fetch("/api/push/subscribe", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, reason: "logout" }),
    }).catch(() => undefined);

    await subscription?.unsubscribe().catch(() => undefined);
  } catch {
    // Best-effort shared-device safety.
  }
}
