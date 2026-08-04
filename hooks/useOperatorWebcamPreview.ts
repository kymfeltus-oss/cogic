"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type OperatorWebcamPreviewStatus = "idle" | "starting" | "active" | "error";

type UseOperatorWebcamPreviewResult = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: OperatorWebcamPreviewStatus;
  errorMessage: string | null;
  isActive: boolean;
  startPreview: () => Promise<void>;
  stopPreview: () => void;
};

function releaseMediaStream(stream: MediaStream | null, video: HTMLVideoElement | null) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  if (video) {
    video.srcObject = null;
  }
}

/**
 * Operator-local webcam monitor only — never published to Supabase or attendees.
 */
export function useOperatorWebcamPreview(): UseOperatorWebcamPreviewResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<OperatorWebcamPreviewStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopPreview = useCallback(() => {
    releaseMediaStream(streamRef.current, videoRef.current);
    streamRef.current = null;
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const startPreview = useCallback(async () => {
    stopPreview();
    setStatus("starting");
    setErrorMessage(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API is not available in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {
          /* Muted inline preview — autoplay should succeed. */
        });
      }

      setStatus("active");
    } catch (error) {
      releaseMediaStream(streamRef.current, videoRef.current);
      streamRef.current = null;
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Camera permission denied or hardware unavailable.",
      );
    }
  }, [stopPreview]);

  useEffect(() => {
    return () => {
      releaseMediaStream(streamRef.current, videoRef.current);
      streamRef.current = null;
    };
  }, []);

  return {
    videoRef,
    status,
    errorMessage,
    isActive: status === "active",
    startPreview,
    stopPreview,
  };
}
