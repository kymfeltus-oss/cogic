"use client";

import Link from "next/link";
import { useState } from "react";
import { Coins, HandHeart, Landmark, Sparkles } from "lucide-react";
import ExperienceGivingPanel from "@/components/experience/live/ExperienceGivingPanel";
import { seedPackages } from "@/lib/seeds/assets";

type MonetizationMode = "seeds" | "offering" | "tithes";

export default function LiveMonetizationPanel({ seedBalance }: { seedBalance: number | null }) {
  const [mode, setMode] = useState<MonetizationMode>("seeds");

  return (
    <div className="live-support">
      <div className="live-support__hero">
        <span><Sparkles aria-hidden="true" /></span>
        <div>
          <strong>Support the Experience</strong>
          <small>Seeds, offerings, and tithes—securely processed.</small>
        </div>
        {seedBalance !== null ? <b>{seedBalance.toLocaleString("en-US")} seeds</b> : null}
      </div>

      <div className="live-support__tabs" role="tablist" aria-label="Choose support type">
        <button type="button" role="tab" aria-selected={mode === "seeds"} onClick={() => setMode("seeds")}>
          <Coins aria-hidden="true" /> Buy Seeds
        </button>
        <button type="button" role="tab" aria-selected={mode === "offering"} onClick={() => setMode("offering")}>
          <HandHeart aria-hidden="true" /> Offering
        </button>
        <button type="button" role="tab" aria-selected={mode === "tithes"} onClick={() => setMode("tithes")}>
          <Landmark aria-hidden="true" /> Tithes
        </button>
      </div>

      {mode === "seeds" ? (
        <div className="live-support__seeds" role="tabpanel">
          <div className="live-support__packs">
            {seedPackages.slice(0, 3).map((pack) => (
              <Link key={pack.packageId} href={`/buy-seeds?package=${encodeURIComponent(pack.packageId)}`}>
                <span>{pack.badge}</span>
                <strong>{pack.seeds.toLocaleString("en-US")}</strong>
                <small>Seeds</small>
                <b>{pack.price}</b>
              </Link>
            ))}
          </div>
          <Link href="/buy-seeds" className="live-support__primary">View all seed packages</Link>
          <p>Use Seeds for interactive moments during live broadcasts.</p>
        </div>
      ) : (
        <div className="live-support__giving" role="tabpanel">
          <ExperienceGivingPanel
            fundKey={mode}
            heading={mode === "offering" ? "Sow an Offering" : "Pay Tithes Securely"}
          />
        </div>
      )}
    </div>
  );
}
