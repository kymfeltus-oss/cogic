"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";

type PrayerModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (request: string) => void;
};

export default function PrayerModal({ open, onClose, onSubmit }: PrayerModalProps) {
  const [request, setRequest] = useState("");

  if (!open) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(request.trim());
    setRequest("");
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="prayer-title"
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-brand-panel/95 p-5 shadow-[0_0_40px_rgba(0,168,255,0.18)] backdrop-blur-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="prayer-title" className="font-headline text-lg uppercase tracking-[0.12em] text-white">
            Send Prayer
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

        <label className="block">
          <span className="mb-2 block font-ui text-[0.58rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
            Prayer request
          </span>
          <textarea
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            rows={4}
            placeholder="Share your prayer request with the room..."
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-body text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-brand-purple/35"
          />
        </label>

        <button
          type="submit"
          className="mt-4 w-full rounded-full border border-brand-purple/40 bg-brand-purple/15 px-4 py-3 font-ui text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-purple"
        >
          Submit Prayer
        </button>
      </form>
    </div>
  );
}
