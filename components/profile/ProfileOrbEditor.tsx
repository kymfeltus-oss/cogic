"use client";

import { useState } from "react";
import ProfileOrb from "@/components/ProfileOrb";
import ProfileEditorModal from "@/components/profile/ProfileEditorModal";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import type { ProfileOrbSize } from "@/components/ProfileOrb";

type ProfileOrbEditorProps = {
  profile: AttendeeProfileSnapshot;
  onProfileChange: (profile: AttendeeProfileSnapshot) => void;
  size?: ProfileOrbSize | number;
};

export default function ProfileOrbEditor({
  profile,
  onProfileChange,
  size = "sm",
}: ProfileOrbEditorProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!profile.userId) {
    return (
      <ProfileOrb
        initials={profile.profileInitials}
        avatarUrl={profile.avatarUrl}
        size={size}
        aria-label="Profile"
      />
    );
  }

  return (
    <>
      <ProfileOrb
        initials={profile.profileInitials}
        avatarUrl={profile.avatarUrl}
        size={size}
        active={isOpen}
        onClick={() => setIsOpen(true)}
        aria-label="Open profile settings"
        aria-pressed={isOpen}
      />

      <ProfileEditorModal
        isOpen={isOpen}
        profile={profile}
        onClose={() => setIsOpen(false)}
        onSaved={(nextProfile) => {
          onProfileChange(nextProfile);
          setIsOpen(false);
        }}
      />
    </>
  );
}
