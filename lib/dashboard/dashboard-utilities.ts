import {
  BadgeCheck,
  CalendarDays,
  HandHeart,
  Megaphone,
  Plane,
  Phone,
  Radio,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type DashboardUtility = {
  title: string;
  copy: string;
  href: string;
  icon: LucideIcon;
};

/** Primary attendee feature shortcuts shared by mobile and desktop dashboard homes. */
export const DASHBOARD_UTILITIES: readonly DashboardUtility[] = [
  { title: "My Registration", copy: "View status, group, payment & credential", href: "/my-convocation/registration", icon: BadgeCheck },
  { title: "COGIC LIVE", copy: "Watch live services", href: "/live", icon: Radio },
  { title: "Digital Program", copy: "Interactive event program", href: "/digital-program", icon: CalendarDays },
  { title: "COGIC Travel", copy: "Official hotels & trip planning", href: "/travel", icon: Plane },
  { title: "COGIC Giving", copy: "Give securely anytime", href: "/giving", icon: HandHeart },
  { title: "Stay Informed", copy: "News, alerts & important updates", href: "/updates", icon: Megaphone },
  { title: "Contact COGIC", copy: "Get help and connect with us", href: "/contact-us", icon: Phone },
  { title: "COGIC Connect", copy: "Connect, engage & grow together", href: "/social", icon: UsersRound },
] as const;
