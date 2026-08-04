/** Server-only — resolves external RTMP ingest credentials for authorized owner operators. */

export type ExternalIngestCredentials = {
  rtmpUrl: string | null;
  streamKey: string | null;
  source: "env" | "unconfigured";
  detail: string | null;
};

export function resolveExternalIngestCredentials(): ExternalIngestCredentials {
  const rtmpUrl = process.env.CUSTOM_RTMP_URL?.trim() || null;
  const streamKey = process.env.CUSTOM_RTMP_STREAM_KEY?.trim() || null;

  if (!rtmpUrl && !streamKey) {
    return {
      rtmpUrl: null,
      streamKey: null,
      source: "unconfigured",
      detail: "Set CUSTOM_RTMP_URL and CUSTOM_RTMP_STREAM_KEY in server environment.",
    };
  }

  return {
    rtmpUrl,
    streamKey,
    source: "env",
    detail: rtmpUrl && streamKey ? "Restream / custom RTMP credentials loaded." : "Partial configuration — verify URL and stream key.",
  };
}
