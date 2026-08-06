"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ClipboardCheck, Radio, UserRound } from "lucide-react";
import ProfileEditorModal from "@/components/profile/ProfileEditorModal";
import { COGIC_LIVE_PUBLIC_NAME } from "@/lib/brand/public-display";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

const actions = [
  {
    href: "/register",
    label: "Registration",
    copy: "Continue or review your Convocation registration.",
    icon: ClipboardCheck,
  },
  {
    href: "/program",
    label: "Schedule",
    copy: "View the published 118th Holy Convocation program.",
    icon: CalendarDays,
  },
  {
    href: "/live",
    label: "Watch Live",
    copy: "Enter the official COGIC LIVE broadcast experience.",
    icon: Radio,
  },
  {
    href: `${ATTENDEE_DASHBOARD_PATH}?view=profile`,
    label: "My profile",
    copy: "Review your attendee account information.",
    icon: UserRound,
  },
] as const;

type MyConvocationHubProps = {
  initialProfile: AttendeeProfileSnapshot;
};

function MyConvocationHubInner({ initialProfile }: MyConvocationHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState(initialProfile);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    const view = searchParams.get("view");
    if (view !== "profile" && view !== "settings") return;
    setProfileModalOpen(true);
    router.replace(ATTENDEE_DASHBOARD_PATH, { scroll: false });
  }, [router, searchParams]);

  return (
    <>
      <main
        id="main-content"
        className="responsive-page pb-[calc(6rem+env(safe-area-inset-bottom,0px))] bg-brand-black text-white"
      >
        <div className="responsive-container">
          <header className="mx-auto max-w-3xl text-center">
            <p className="font-ui text-sm font-semibold uppercase tracking-[0.14em] text-brand-pink">
              {COGIC_LIVE_PUBLIC_NAME}
            </p>
            <h1 className="mt-3 font-headline text-[clamp(2.5rem,8vw,5rem)] leading-none">
              My Convocation
            </h1>
            <p className="mx-auto mt-5 max-w-prose font-body text-base leading-7 text-white/75">
              Registration, schedule, live broadcast, and your attendee profile — one hub for the
              118th Holy Convocation.
            </p>
          </header>
          <section
            className="responsive-card-grid mx-auto mt-10 max-w-5xl"
            aria-label="My Convocation actions"
          >
            {actions.map(({ href, label, copy, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="touch-target group flex min-h-36 flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-brand-blue/50 hover:bg-brand-blue/[0.08] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue"
              >
                <Icon className="size-7 text-brand-blue" aria-hidden="true" />
                <h2 className="mt-4 font-card-title text-xl">{label}</h2>
                <p className="mt-2 font-body text-base leading-6 text-white/70">{copy}</p>
              </Link>
            ))}
          </section>
        </div>
      </main>

      {profile.userId ? (
        <ProfileEditorModal
          isOpen={profileModalOpen}
          profile={profile}
          onClose={() => setProfileModalOpen(false)}
          onSaved={(nextProfile) => {
            setProfile(nextProfile);
            setProfileModalOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

export default function MyConvocationHub(props: MyConvocationHubProps) {
  return (
    <Suspense fallback={null}>
      <MyConvocationHubInner {...props} />
    </Suspense>
  );
}
