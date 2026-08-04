import type { LucideIcon } from "lucide-react";
import { Bell, Calendar, Camera, Music, Radio, Sparkles } from "lucide-react";

export type UpdateEntryType = "push" | "countdown" | "alert";

export type UpdateEntry = {
  id: string;
  type: UpdateEntryType;
  title: string;
  body: string;
  timestamp: string;
  priority: "low" | "medium" | "high";
  icon: LucideIcon;
  metric?: string;
};

export const UPDATE_REGISTRY_ENTRIES: readonly UpdateEntry[] = [
  {
    id: "u-1",
    type: "countdown",
    title: "Live Recording Night",
    body: "Faith Kingdom Church doors open at 6:30 PM CST. Stream goes live at 7:30 PM CST.",
    timestamp: "2026-05-24T19:00:00-05:00",
    priority: "high",
    icon: Calendar,
    metric: "Event T-Minus",
  },
  {
    id: "u-2",
    type: "push",
    title: "Rehearsal Recap Posted",
    body: "Behind-the-scenes choir rehearsal footage is now available in the hub archive.",
    timestamp: "2026-06-02T14:20:00-05:00",
    priority: "medium",
    icon: Camera,
  },
  {
    id: "u-3",
    type: "alert",
    title: "Harvest Milestone Alert",
    body: "The Awakening network crossed 48K in collective seed sowing this week.",
    timestamp: "2026-06-04T09:15:00-05:00",
    priority: "high",
    icon: Sparkles,
    metric: "$48,250",
  },
  {
    id: "u-4",
    type: "push",
    title: "New Single Update",
    body: "Hallelujah Anyhow pre-save links are active across all major platforms.",
    timestamp: "2026-06-03T11:00:00-05:00",
    priority: "medium",
    icon: Music,
  },
  {
    id: "u-5",
    type: "alert",
    title: "Live Hub Capacity Notice",
    body: "Virtual ticket lanes are open. Secure stream access before doors close.",
    timestamp: "2026-06-06T08:45:00-05:00",
    priority: "high",
    icon: Radio,
    metric: "Open",
  },
  {
    id: "u-6",
    type: "push",
    title: "Stay Connected",
    body: "Enable push notifications to receive prayer prompts and setlist reveals.",
    timestamp: "2026-06-05T16:30:00-05:00",
    priority: "low",
    icon: Bell,
  },
] as const;

export function formatRegistryTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getUpdateTypeLabel(type: UpdateEntryType): string {
  switch (type) {
    case "push":
      return "Push Communication";
    case "countdown":
      return "Countdown Event";
    case "alert":
      return "Hub Alert";
  }
}
