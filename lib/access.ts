import type { User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { BroadcastCurrentState } from "@/lib/live/types";

export const LIVE_PASS_PRODUCT_ID = "live-pass";

export const DEV_BYPASS_SESSION_PREFIX = "dev_bypass_";

export type AccessContext = {
  userId: string | null;
  email: string | null;
  isGuest: boolean;
};

export type LivePublishMode = "none" | "external_hls" | "rtmp_encoder" | "browser_camera";

export type LiveAccessEvaluation = {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  isGuest: boolean;
  hasPaidPass: boolean;
  canViewStream: boolean;
  showStreamPaywall: boolean;
  showFullLockdown: boolean;
  streamIsLive: boolean;
  /** Authoritative broadcast lifecycle from live_stream_state.current_state. */
  currentState: BroadcastCurrentState;
  playbackUrl: string;
  publishMode: LivePublishMode;
  publisherChannel: string | null;
};

export function generateGuestEmail(): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  return `guest_${suffix}@awakening.local`;
}

export function generateGuestPassword(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function parseAccessContext(user: User | null): AccessContext {
  if (!user) {
    return { userId: null, email: null, isGuest: false };
  }

  return {
    userId: user.id,
    email: user.email?.trim().toLowerCase() ?? null,
    isGuest: user.user_metadata?.is_guest === true,
  };
}

/** Resolve identity from the verified Supabase browser session (never localStorage). */
export async function fetchAccessContext(): Promise<AccessContext> {
  const supabase = createBrowserSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { userId: null, email: null, isGuest: false };
  }

  return parseAccessContext(user);
}

/** Async identity read — backed by server-verified Supabase session cookies. */
export async function getUserEmail(): Promise<string | null> {
  const context = await fetchAccessContext();
  return context.email;
}

export function evaluateLiveAccessFromFlags(
  email: string | null,
  isGuest: boolean,
  hasPaidPass: boolean,
): LiveAccessEvaluation {
  const authenticated = Boolean(email);
  /** Live concert is free — signed-in attendees enter; only auth is required. */
  const canViewStream = authenticated;
  const showStreamPaywall = false;
  const showFullLockdown = !authenticated;

  return {
    authenticated,
    userId: null,
    email,
    isGuest,
    hasPaidPass,
    canViewStream,
    showStreamPaywall,
    showFullLockdown,
    streamIsLive: false,
    currentState: "offline",
    playbackUrl: "",
    publishMode: "none",
    publisherChannel: null,
  };
}

/** Server-authoritative live access evaluation via API route. */
export async function fetchLiveAccessEvaluation(): Promise<LiveAccessEvaluation> {
  const response = await fetch("/api/access/live", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) {
    return evaluateLiveAccessFromFlags(null, false, false);
  }

  if (!response.ok) {
    throw new Error("Unable to evaluate live access.");
  }

  const payload = (await response.json()) as Partial<LiveAccessEvaluation>;
  return {
    ...evaluateLiveAccessFromFlags(
      payload.email ?? null,
      payload.isGuest === true,
      payload.hasPaidPass === true,
    ),
    ...payload,
    currentState: payload.currentState ?? "offline",
    streamIsLive: payload.streamIsLive === true,
    publishMode: payload.publishMode ?? "none",
    publisherChannel: payload.publisherChannel ?? null,
    playbackUrl: payload.playbackUrl ?? "",
  };
}

/** True when stripe_session_id was issued by the guest/dev email-gate bypass */
export function isDevBypassSession(stripeSessionId: string): boolean {
  return stripeSessionId.startsWith(DEV_BYPASS_SESSION_PREFIX);
}
