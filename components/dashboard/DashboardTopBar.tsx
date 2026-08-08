"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import AnnouncementBell from "@/components/dashboard/AnnouncementBell";
import DashboardSearch from "@/components/dashboard/DashboardSearch";
import AttendeeDesktopNav from "@/components/navigation/AttendeeDesktopNav";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

export default function DashboardTopBar({
  profile,
  profileReturnPath = "/my-convocation",
  onProfile,
}: {
  profile: AttendeeProfileSnapshot;
  profileReturnPath?: string;
  onProfile: () => void;
}) {
  const pathname = usePathname() || profileReturnPath;
  const profileLabel =
    profile.title && profile.lastName
      ? `${profile.title} ${profile.lastName}`
      : profile.firstName || "Guest";

  return (
    <header className="cl-topbar cl-topbar--hub">
      <div className="cl-topbar__brand">
        <Link href={profileReturnPath} className="cl-topbar__brand-link" aria-label="COGIC LIVE home">
          <Image
            src="/my-sanctuary/cogic-live-logo-purple.png"
            alt="COGIC LIVE"
            width={1250}
            height={270}
            priority
            sizes="(max-width: 720px) 116px, 168px"
            className="cl-topbar__logo"
          />
        </Link>
      </div>

      <AttendeeDesktopNav pathname={pathname} homeHref={profileReturnPath} ariaLabel="Dashboard navigation" />

      <div className="cl-topbar__tools" aria-label="Dashboard tools">
        <DashboardSearch />
        <AnnouncementBell />

        {profile.userId ? (
          <div className="cl-topbar__account">
            <button
              type="button"
              className="cl-topbar__profile"
              onClick={onProfile}
              aria-label={`Open profile for ${profileLabel}`}
            >
              {profile.avatarUrl ? (
                <Image src={profile.avatarUrl} alt="" width={40} height={40} unoptimized />
              ) : (
                <span className="cl-topbar__avatar" aria-hidden="true">
                  {profile.profileInitials || <UserRound />}
                </span>
              )}
            </button>
          </div>
        ) : (
          <a
            href={`/login?next=${encodeURIComponent(profileReturnPath)}`}
            className="cl-btn cl-btn--compact"
          >
            Sign in
          </a>
        )}
      </div>
    </header>
  );
}
