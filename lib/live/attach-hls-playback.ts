import type Hls from "hls.js";

export type AttachHlsPlaybackOptions = {
  onManifestParsed?: () => void;
  onFatalError?: (details: string) => void;
};

/**
 * Client-only HLS attach — prefers hls.js (MSE) on Chrome; native only on Safari/iOS.
 * Returns a cleanup function that destroys the Hls instance and detaches media.
 */
export async function attachHlsPlayback(
  video: HTMLVideoElement,
  streamUrl: string,
  options: AttachHlsPlaybackOptions = {},
): Promise<() => void> {
  const HlsModule = (await import("hls.js")).default;

  if (HlsModule.isSupported()) {
    const hls: Hls = new HlsModule({
      enableWorker: true,
      xhrSetup: (xhr) => {
        xhr.withCredentials = false;
      },
    });

    hls.loadSource(streamUrl);
    hls.attachMedia(video);

    hls.on(HlsModule.Events.MANIFEST_PARSED, () => {
      options.onManifestParsed?.();
      void video.play().catch(() => undefined);
    });

    hls.on(HlsModule.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      options.onFatalError?.(data.details || data.type || "HLS error");
    });

    return () => {
      hls.destroy();
    };
  }

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = streamUrl;
    video.load();
    options.onManifestParsed?.();
    void video.play().catch(() => undefined);
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }

  options.onFatalError?.("This browser cannot play the live HLS stream.");
  return () => undefined;
}
