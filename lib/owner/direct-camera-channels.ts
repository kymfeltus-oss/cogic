export function buildPublisherChannelName(sessionId: string): string {
  return `owner-camera-${sessionId}`;
}

export function buildPublisherBrowserChannelName(sessionId: string): string {
  return `owner-camera-${sessionId}-browser`;
}

export function resolvePublisherBrowserChannel(liveChannel: string): string {
  if (liveChannel.startsWith("owner-camera-")) {
    const sessionId = liveChannel.slice("owner-camera-".length);
    return buildPublisherBrowserChannelName(sessionId);
  }
  return `${liveChannel}-browser`;
}
