import {
  BadgeCheck,
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
  { title: "Registration", copy: "Register & manage your experience", href: "/register", icon: BadgeCheck },
  { title: "COGIC LIVE", copy: "Watch live services", href: "/live", icon: Radio },
  { title: "COGIC Travel", copy: "Official hotels & trip planning", href: "/travel", icon: Plane },
  { title: "COGIC Giving", copy: "Give securely anytime", href: "/giving", icon: HandHeart },
  { title: "Stay Informed", copy: "News, alerts & important updates", href: "/updates", icon: Megaphone },
  { title: "Contact COGIC", copy: "Get help and connect with us", href: "/contact-us", icon: Phone },
  { title: "COGIC Connect", copy: "Connect, engage & grow together", href: "/social", icon: UsersRound },
] as const;
