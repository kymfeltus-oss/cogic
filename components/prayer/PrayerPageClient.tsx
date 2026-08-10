"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import AwakeningMenuButton from "@/components/AwakeningMenuButton";
import ProfileOrbEditor from "@/components/profile/ProfileOrbEditor";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";
import { CONTENT_WITH_NAV } from "@/lib/responsive";

type ContactUsPageClientProps = {
  initialProfile: AttendeeProfileSnapshot;
};

export default function ContactUsPageClient({ initialProfile }: ContactUsPageClientProps) {
  const [profile, setProfile] = useState(initialProfile);

  return (
    <div className={`contact-us-page ${CONTENT_WITH_NAV} relative min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden bg-brand-black text-white`}>
      <div className="contact-us-page__glow pointer-events-none" aria-hidden="true" />

      <div className="relative z-[1] mx-auto w-full max-w-2xl px-4 py-5 pt-safe sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={ATTENDEE_DASHBOARD_PATH}
              className="touch-target inline-flex min-h-11 items-center gap-1 font-ui text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-muted transition hover:text-brand-blue"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Back
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              <ProfileOrbEditor profile={profile} onProfileChange={setProfile} size={40} />
              <AwakeningMenuButton className="shrink-0" />
            </div>
          </div>

          <div className="mx-auto mt-5 max-w-md overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#050714] shadow-[0_1.25rem_3rem_rgb(0_0_0_/_0.32)]">
            <Image
              src="/contact-us/contact-us.png"
              width={864}
              height={1821}
              priority
              sizes="(max-width: 448px) calc(100vw - 2rem), 448px"
              alt="COGIC LIVE contact information and support options"
              className="block h-auto w-full"
            />
          </div>
        </header>

      </div>
    </div>
  );
}

/** @deprecated Use ContactUsPageClient as default export. */
export { ContactUsPageClient as PrayerPageClient };
