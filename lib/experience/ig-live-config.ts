/** Instagram-style live viewer chrome — creator + brand copy. */

import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";

export const IG_LIVE_CREATOR = {
  name: "COGIC LIVE",
  subtitle: "118th Holy Convocation",
  avatarSrc: "/images/logo.png",
  exitHref: ATTENDEE_DASHBOARD_PATH,
} as const;

export type IgLiveSheetAction = "prayer" | "give" | "program" | "polls" | "more" | null;

export const IG_LIVE_SHEET_TITLES: Record<
  Exclude<IgLiveSheetAction, null | "more">,
  string
> = {
  prayer: "Prayer",
  give: "Give Seeds",
  program: "Event Program",
  polls: "Live Polls",
};
