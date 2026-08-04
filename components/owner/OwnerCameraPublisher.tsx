"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import {
  clearDirectCameraChannelSignals,
  createDirectCameraClientId,
  createDirectCameraPeer,
  markDirectCameraChannelJoined,
  sendDirectCameraSignal,
  tryFlushDirectCameraChannelSignals,
  type DirectCameraSignal,
} from "@/lib/experience/direct-camera-live";

type OwnerCameraPublisherProps = {
  liveChannel: string;
  browserChannel: string;
  sessionId: string;
};

type PublisherStatus = "idle" | "starting" | "live" | "error";

export default function OwnerCameraPublisher({
  liveChannel,
  browserChannel,
  sessionId,
}: OwnerCameraPublisherProps) {
  const publisherIdRef = useRef(createDirectCameraClientId("owner-publisher"));
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const offerInFlightRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null);
  const browserChannelRef = useRef<BroadcastChannel | null>(null);
  const [status, setStatus] = useState<PublisherStatus>("idle");
  const [message, setMessage] = useState("Ready to publish from owner camera.");
  const [viewerCount, setViewerCount] = useState(0);

  const sendSignal = useCallback((payload: DirectCameraSignal) => {
    sendDirectCameraSignal(channelRef.current, payload);
    tryFlushDirectCameraChannelSignals(channelRef.current);
    browserChannelRef.current?.postMessage(payload);
  }, []);

  const closePeer = useCallback((viewerId: string) => {
    offerInFlightRef.current.delete(viewerId);
    const peer = peersRef.current.get(viewerId);
    if (peer) peer.close();
    peersRef.current.delete(viewerId);
    setViewerCount(peersRef.current.size);
  }, []);

  const createOfferForViewer = useCallback(
    async (viewerId: string) => {
      const stream = streamRef.current;
      if (!stream) return;

      if (offerInFlightRef.current.has(viewerId)) return;

      offerInFlightRef.current.add(viewerId);
      closePeer(viewerId);

      const peer = createDirectCameraPeer();
      peersRef.current.set(viewerId, peer);
      setViewerCount(peersRef.current.size);

      try {
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        peer.onicecandidate = (event) => {
          if (!event.candidate) return;
          sendSignal({
            type: "ice",
            targetId: viewerId,
            senderId: publisherIdRef.current,
            candidate: event.candidate.toJSON(),
          });
        };
        peer.onconnectionstatechange = () => {
          if (["closed", "disconnected", "failed"].includes(peer.connectionState)) {
            closePeer(viewerId);
          }
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        sendSignal({
          type: "offer",
          viewerId,
          publisherId: publisherIdRef.current,
          sdp: offer,
        });
      } catch (error) {
        console.error("[owner-camera] offer failed:", error);
        closePeer(viewerId);
      } finally {
        offerInFlightRef.current.delete(viewerId);
      }
    },
    [closePeer, sendSignal],
  );

  const handleSignal = useCallback(
    async (payload: DirectCameraSignal) => {
      if (payload.type === "viewer-ready") {
        void createOfferForViewer(payload.viewerId);
        return;
      }

      if (payload.type === "answer" && payload.publisherId === publisherIdRef.current) {
        const peer = peersRef.current.get(payload.viewerId);
        if (!peer || peer.signalingState !== "have-local-offer") return;
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } catch (error) {
          console.error("[owner-camera] answer failed:", error);
        }
        return;
      }

      if (payload.type === "ice" && payload.targetId === publisherIdRef.current) {
        const peer = peersRef.current.get(payload.senderId);
        if (!peer || peer.signalingState === "closed") return;
        try {
          await peer.addIceCandidate(payload.candidate);
        } catch (error) {
          console.warn("[owner-camera] ICE failed:", error);
        }
      }
    },
    [createOfferForViewer],
  );

  const stopPublishing = useCallback(() => {
    sendSignal({ type: "publisher-offline", publisherId: publisherIdRef.current });
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    setViewerCount(0);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setMessage("Owner camera stopped.");
  }, [sendSignal]);

  const startPublishing = useCallback(async () => {
    setStatus("starting");
    setMessage("Requesting camera and microphone...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      const supabase = getSupabase();
      const channel = supabase.channel(liveChannel, {
        config: { broadcast: { self: false } },
      });
      channel.on("broadcast", { event: "signal" }, ({ payload }) => {
        void handleSignal(payload as DirectCameraSignal);
      });
      channel.subscribe((subscribeStatus) => {
        if (subscribeStatus !== "SUBSCRIBED") return;
        markDirectCameraChannelJoined(channel);
        sendSignal({ type: "publisher-online", publisherId: publisherIdRef.current });
      });
      channelRef.current = channel;

      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel(browserChannel);
        bc.onmessage = (event: MessageEvent<DirectCameraSignal>) => {
          void handleSignal(event.data);
        };
        browserChannelRef.current = bc;
        bc.postMessage({
          type: "publisher-online",
          publisherId: publisherIdRef.current,
        } satisfies DirectCameraSignal);
      }

      setStatus("live");
      setMessage(`Publishing on session ${sessionId}. Keep this page open.`);
    } catch (error) {
      console.error("[owner-camera]", error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to open camera.");
    }
  }, [browserChannel, handleSignal, liveChannel, sendSignal, sessionId]);

  useEffect(() => {
    return () => {
      stopPublishing();
      const supabase = getSupabase();
      if (channelRef.current) {
        clearDirectCameraChannelSignals(channelRef.current);
        void supabase.removeChannel(channelRef.current);
      }
      browserChannelRef.current?.close();
    };
  }, [stopPublishing]);

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.22em] text-brand-blue">
              Owner Camera
            </p>
            <h1 className="font-headline text-xl uppercase tracking-[0.08em]">Browser Publisher</h1>
          </div>
          <Link
            href="/owner/control"
            className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/60"
          >
            Control Room
          </Link>
        </header>

        <section className="flex flex-1 flex-col gap-4 p-4">
          <div className="relative min-h-[55dvh] overflow-hidden rounded-lg border border-white/10 bg-black">
            <video
              ref={videoRef}
              className="h-full min-h-[55dvh] w-full object-contain"
              autoPlay
              muted
              playsInline
            />
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p className="font-body text-sm text-white/80">{message}</p>
            <p className="mt-2 font-body text-xs text-white/50">Connected viewers: {viewerCount}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void startPublishing()}
                disabled={status === "starting" || status === "live"}
                className="min-h-11 rounded-full bg-brand-blue px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-black disabled:opacity-50"
              >
                {status === "starting" ? "Starting..." : "Start Camera"}
              </button>
              <button
                type="button"
                onClick={stopPublishing}
                disabled={status !== "live"}
                className="min-h-11 rounded-full border border-white/15 px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white disabled:opacity-50"
              >
                Stop
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
