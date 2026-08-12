"use client";

import Image from "next/image";
import { UserRound } from "lucide-react";
import AnnouncementBell from "@/components/dashboard/AnnouncementBell";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import styles from "./DashboardTopBar.module.css";

/** Persistent dashboard controls, intentionally independent of decorative header media. */
export default function DashboardTopBar({
  profile,
  profileReturnPath = "/my-convocation",
  onProfile,
}: {
  profile: AttendeeProfileSnapshot;
  profileReturnPath?: string;
  onProfile: () => void;
}) {
  const profileLabel =
    profile.title && profile.lastName
      ? `${profile.title} ${profile.lastName}`
      : profile.firstName || "Guest";

  const avatar = profile.avatarUrl ? (
    <Image src={profile.avatarUrl} alt="" width={40} height={40} unoptimized />
  ) : (
    <span className="cl-topbar__avatar" aria-hidden="true">
      {profile.userId && profile.profileInitials ? profile.profileInitials : <UserRound />}
    </span>
  );

  return (
    <div className={`${styles.root} cl-dashboard-controls`}>
      <div className={`${styles.tools} cl-topbar__tools`} role="group" aria-label="Dashboard tools">
        <div className="cl-topbar__account">
          {profile.userId ? (
            <button
              type="button"
              className="cl-topbar__profile"
              onClick={onProfile}
              aria-label={`Open profile for ${profileLabel}`}
            >
              {avatar}
            </button>
          ) : (
            <a
              href={`/login?next=${encodeURIComponent(profileReturnPath)}`}
              className="cl-topbar__profile"
              aria-label="Sign in to access your profile"
            >
              {avatar}
            </a>
          )}
        </div>

        <AnnouncementBell />
      </div>
    </div>
  );
}
