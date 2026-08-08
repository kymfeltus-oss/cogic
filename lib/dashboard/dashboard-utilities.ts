import {
  BadgeCheck,
  CalendarDays,
  Church,
  HandHeart,
  Megaphone,
  Plane,
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
  { title: "COGIC Travel", copy: "Book flights, hotels & more", href: "/travel", icon: Plane },
  { title: "Program", copy: "View full schedule & events", href: "/program", icon: CalendarDays },
  { title: "COGIC Giving", copy: "Give securely anytime", href: "/giving", icon: HandHeart },
  { title: "Registration", copy: "Register & manage your experience", href: "/register", icon: BadgeCheck },
  { title: "My Sanctuary", copy: "Your activities & favorites", href: "/my-sanctuary", icon: Church },
  { title: "Stay Informed", copy: "News, alerts & important updates", href: "/updates", icon: Megaphone },
  { title: "COGIC Social", copy: "Connect, engage & grow together", href: "/experience/live", icon: UsersRound },
] as const;
