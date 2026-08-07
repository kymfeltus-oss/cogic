"use client";

import Link from "next/link";
import {
  Archive,
  CalendarDays,
  Megaphone,
  MonitorDot,
  Palette,
  Play,
  Radio,
  ScanLine,
  Timer,
  Video,
} from "lucide-react";

const PRODUCTION_NAV_ITEMS = [
  { id: "check-in", label: "Check-In", eyebrow: "Door operations", href: "/owner/check-in", icon: ScanLine },
  { id: "housing", label: "Housing", eyebrow: "Hotels & requests", href: "/owner/housing", icon: Archive },
  { id: "tickets", label: "Tickets & Add-ons", eyebrow: "Commerce", href: "/owner/tickets", icon: ScanLine },
  {
    id: "registrations",
    label: "Registration Access",
    eyebrow: "Products & rules",
    href: "/owner/registrations",
    icon: ScanLine,
  },
  {
    id: "cockpit",
    label: "Cockpit",
    eyebrow: "Execution deck",
    href: "/owner/cockpit",
    icon: MonitorDot,
  },
  {
    id: "graphics",
    label: "Graphics",
    eyebrow: "Build suite",
    href: "/owner/graphics",
    icon: Palette,
  },
  {
    id: "broadcast",
    label: "Broadcast",
    eyebrow: "Go-live control",
    href: "/owner/control",
    icon: Radio,
  },
  {
    id: "events",
    label: "Events",
    eyebrow: "Schedule",
    href: "/owner/events",
    icon: CalendarDays,
  },
  {
    id: "announcements",
    label: "Announcements",
    eyebrow: "Updates & alerts",
    href: "/owner/announcements",
    icon: Megaphone,
  },
  {
    id: "replays",
    label: "Media / Replays",
    eyebrow: "Publish catalog",
    href: "/owner/replays",
    icon: Video,
  },
  {
    id: "archives",
    label: "Archives",
    eyebrow: "Year collections",
    href: "/owner/archives",
    icon: Archive,
  },
  {
    id: "countdown",
    label: "Countdown",
    eyebrow: "Lobby clock",
    href: "/owner/countdown",
    icon: Timer,
  },
  {
    id: "camera",
    label: "Camera",
    eyebrow: "Publisher",
    href: "/owner/publish/camera",
    icon: Play,
  },
] as const;

type OwnerProductionSideMenuProps = {
  active: (typeof PRODUCTION_NAV_ITEMS)[number]["id"];
};

export default function OwnerProductionSideMenu({ active }: OwnerProductionSideMenuProps) {
  return (
    <nav
      aria-label="Production side navigation"
      className="shrink-0 rounded-[6px] border border-white/10 bg-[#050814]/94 p-2 shadow-[0_0_28px_rgba(0,168,255,0.08)] xl:sticky xl:top-2 xl:h-[calc(100dvh-1rem)] xl:w-48"
    >
      <div className="hidden border-b border-white/10 px-2 pb-3 xl:block">
        <p className="font-ui text-[0.54rem] font-black uppercase tracking-[0.16em] text-[#00a8ff]">
          Production
        </p>
        <p className="mt-1 font-headline text-lg uppercase leading-none text-white">
          Side Menu
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto xl:mt-3 xl:flex-col xl:overflow-visible">
        {PRODUCTION_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`group flex min-h-12 min-w-[9.75rem] items-center gap-2 rounded-md border px-2.5 py-2 transition xl:min-w-0 ${
                isActive
                  ? "border-[#00a8ff]/55 bg-[#00a8ff]/12 text-white shadow-[0_0_18px_rgba(0,168,255,0.18)]"
                  : "border-white/8 bg-black/24 text-white/70 hover:border-[#00a8ff]/35 hover:bg-[#00a8ff]/8 hover:text-white"
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded border ${
                  isActive
                    ? "border-[#00a8ff]/55 bg-[#00a8ff]/15 text-[#00a8ff]"
                    : "border-white/10 bg-white/[0.03] text-white/55 group-hover:text-[#00a8ff]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-ui text-[0.63rem] font-black uppercase tracking-[0.1em]">
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate font-body text-[0.56rem] text-white/45">
                  {item.eyebrow}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
