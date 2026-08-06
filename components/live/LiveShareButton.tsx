"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { buildCanonicalLiveShareUrl } from "@/lib/sharing/canonical";

type LiveShareButtonProps = {
  className?: string;
  label?: string;
};

/**
 * Shares the canonical public /live URL only — never private HLS/provider URLs.
 */
export default function LiveShareButton({
  className,
  label = "Share",
}: LiveShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = buildCanonicalLiveShareUrl();
    try {
      if (navigator.share) {
        await navigator.share({
          title: "COGIC LIVE",
          text: "Watch COGIC LIVE",
          url,
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Cancellation is silent; failures must not fake success.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={className}
      aria-label={copied ? "Live link copied" : "Share live stream"}
    >
      <Share2 className="size-4" aria-hidden="true" />
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}
