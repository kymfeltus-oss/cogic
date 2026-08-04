"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { SEED_PACKAGES, type SeedPackageId } from "@/lib/live-stream-routes";

type SowSeedModalProps = {
  open: boolean;
  streamId: string;
  onClose: () => void;
};

export default function SowSeedModal({ open, streamId, onClose }: SowSeedModalProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<SeedPackageId>("300");

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sow-seed-title"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-brand-panel/95 p-5 shadow-[0_0_40px_rgba(138,46,255,0.25)] backdrop-blur-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="sow-seed-title" className="font-headline text-lg uppercase tracking-[0.12em] text-white">
            Sow a Seed
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="touch-target flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {SEED_PACKAGES.map((pkg) => {
            const active = selected === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelected(pkg.id)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-brand-pink/50 bg-brand-pink/10 shadow-[0_0_20px_rgba(255,47,175,0.2)]"
                    : "border-white/10 bg-black/30 hover:border-brand-purple/30"
                }`}
              >
                <span className="font-ui text-sm font-semibold text-white">
                  {pkg.seeds.toLocaleString("en-US")} Seeds
                </span>
                <span className="font-ui text-sm font-bold text-brand-blue">{pkg.priceLabel}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            // Live package checkout is unfinished — route to the real Stripe seed store.
            router.push(`/buy-seeds?package=${encodeURIComponent(selected)}`);
            onClose();
          }}
          className="mt-4 w-full rounded-full border border-brand-blue/40 bg-brand-blue/15 px-4 py-3 font-ui text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-blue"
        >
          Continue in Seed Store
        </button>
        <p className="mt-3 text-center font-body text-xs text-white/50">
          In-stream checkout is unavailable. Stream: {streamId}
        </p>
      </div>
    </div>
  );
}
