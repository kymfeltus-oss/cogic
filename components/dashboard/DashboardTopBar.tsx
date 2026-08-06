import Image from "next/image";
import { UserRound } from "lucide-react";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

export default function DashboardTopBar({ profile, profileReturnPath = "/my-convocation", onProfile }: { profile: AttendeeProfileSnapshot; profileReturnPath?: string; onProfile: () => void }) {
  return (
    <header className="cogic-topbar">
      <div className="cogic-organization">
        <Image
          className="cogic-organization__seal"
          src="/branding/cogic-seal.png"
          alt="Church of God in Christ seal"
          width={54}
          height={36}
          sizes="54px"
          quality={90}
        />
        <span>Church of God in Christ, Inc.</span>
      </div>
      {profile.userId ? (
        <button type="button" className="cogic-profile" onClick={onProfile} aria-label="Open attendee profile">
          {profile.avatarUrl ? <Image src={profile.avatarUrl} alt="" width={38} height={38} unoptimized /> : <span className="cogic-profile__avatar"><UserRound aria-hidden="true" /></span>}
          <span className="cogic-profile__copy"><strong>{profile.headerDisplayName}</strong><small>Attendee</small></span>
        </button>
      ) : (
        <a href={`/login?next=${encodeURIComponent(profileReturnPath)}`} className="cogic-profile cogic-profile--signin">Sign in</a>
      )}
    </header>
  );
}
