"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { buildCanonicalReplayShareUrl } from "@/lib/sharing/canonical";

export default function ShareButton({
  title,
  replayId,
}: {
  title: string;
  replayId: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = buildCanonicalReplayShareUrl(replayId);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // User cancellation is intentionally silent.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 font-ui text-sm font-bold text-white"
      aria-label={copied ? "Replay link copied" : "Share replay"}
    >
      <Share2 className="size-4" aria-hidden="true" /> {copied ? "Copied" : "Share"}
    </button>
  );
}
