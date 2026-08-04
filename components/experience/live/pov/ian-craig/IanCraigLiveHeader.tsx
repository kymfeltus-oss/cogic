"use client";

import { BadgeCheck, MoreHorizontal, X } from "lucide-react";
import ProfileOrbEditor from "@/components/profile/ProfileOrbEditor";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

type IanCraigLiveHeaderProps = {
  viewerLabel: string;
  profile: AttendeeProfileSnapshot;
  onProfileChange: (profile: AttendeeProfileSnapshot) => void;
  onMore: () => void;
  onClose: () => void;
};

export default function IanCraigLiveHeader({
  viewerLabel,
  profile,
  onProfileChange,
  onMore,
  onClose,
}: IanCraigLiveHeaderProps) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-[clamp(0.75rem,3vw,1.25rem)] pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex min-w-0 items-center gap-2.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-blue/30 font-ui text-sm font-bold text-white ring-2 ring-white/25"
          aria-hidden="true"
        >
          LV
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-ui text-sm font-semibold text-white viewer-pov-text-shadow">
              Live Broadcast
            </p>
            <BadgeCheck className="h-4 w-4 shrink-0 text-brand-blue" aria-label="Verified host" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-ui text-[0.58rem] font-bold uppercase tracking-wider text-white">
              Broadcast
            </span>
            {viewerLabel ? (
              <span className="rounded-full bg-black/45 px-2.5 py-0.5 font-ui text-[0.58rem] font-semibold text-white backdrop-blur-sm viewer-pov-text-shadow">
                {viewerLabel} watching
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        <div className="viewer-pov-profile-orb shrink-0">
          <ProfileOrbEditor profile={profile} onProfileChange={onProfileChange} size={40} />
        </div>
        <button
          type="button"
          onClick={onMore}
          className="touch-target flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/55"
          aria-label="More actions"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="touch-target flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/55"
          aria-label="Close live experience"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
