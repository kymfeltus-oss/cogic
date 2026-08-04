"use client";

export const DIRECT_CAMERA_LIVE_CHANNEL = "direct-camera-live-test";
export const DIRECT_CAMERA_BROWSER_CHANNEL = "direct-camera-live-test-browser";

export type DirectCameraSignal =
  | { type: "publisher-online"; publisherId: string }
  | { type: "publisher-offline"; publisherId: string }
  | { type: "viewer-ready"; viewerId: string }
  | { type: "offer"; viewerId: string; publisherId: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; viewerId: string; publisherId: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; targetId: string; senderId: string; candidate: RTCIceCandidateInit };

type DirectSignalChannel = {
  state?: string;
  send(args: { type: "broadcast"; event: string; payload: DirectCameraSignal }): Promise<unknown>;
  httpSend(event: string, payload: DirectCameraSignal, opts?: { timeout?: number }): Promise<unknown>;
  channelAdapter?: { canPush?: () => boolean };
};

const joinedChannels = new WeakSet<DirectSignalChannel>();
const pendingByChannel = new WeakMap<DirectSignalChannel, DirectCameraSignal[]>();

/** Supabase falls back to REST (/events/signal) when canPush() is false — avoid that path. */
function canBroadcastOnChannel(channel: DirectSignalChannel): boolean {
  if (channel.channelAdapter?.canPush) {
    return channel.channelAdapter.canPush();
  }
  return channel.state === "joined" && joinedChannels.has(channel);
}

function flushPendingSignals(channel: DirectSignalChannel): void {
  if (!canBroadcastOnChannel(channel)) return;

  const pending = pendingByChannel.get(channel);
  if (!pending?.length) return;
  pendingByChannel.delete(channel);

  for (const payload of pending) {
    void channel.send({
      type: "broadcast",
      event: "signal",
      payload,
    });
  }
}

/** Call when Supabase subscribe status becomes SUBSCRIBED. */
export function markDirectCameraChannelJoined(
  channel: DirectSignalChannel | null | undefined,
): void {
  if (!channel) return;
  joinedChannels.add(channel);
  flushPendingSignals(channel);
}

/** Retry flushing queued signals (e.g. after socket reconnect). */
export function tryFlushDirectCameraChannelSignals(
  channel: DirectSignalChannel | null | undefined,
): void {
  if (!channel || !joinedChannels.has(channel)) return;
  flushPendingSignals(channel);
}

/** Call on channel teardown to drop queued signals. */
export function clearDirectCameraChannelSignals(
  channel: DirectSignalChannel | null | undefined,
): void {
  if (!channel) return;
  joinedChannels.delete(channel);
  pendingByChannel.delete(channel);
}

export function canSendDirectCameraSignal(
  channel: DirectSignalChannel | null | undefined,
): boolean {
  return Boolean(channel && canBroadcastOnChannel(channel));
}

export function sendDirectCameraSignal(
  channel: DirectSignalChannel | null | undefined,
  payload: DirectCameraSignal,
): void {
  if (!channel) return;

  if (canBroadcastOnChannel(channel)) {
    void channel.send({
      type: "broadcast",
      event: "signal",
      payload,
    });
    return;
  }

  const queue = pendingByChannel.get(channel) ?? [];
  queue.push(payload);
  pendingByChannel.set(channel, queue);
}

export function createDirectCameraPeer(): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
}

export function createDirectCameraClientId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
