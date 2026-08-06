import type { LucideIcon } from "lucide-react";

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

/**
 * Attendee updates must come from a real notifications/publishing system.
 * Until that backend exists, the registry stays empty — never invent feed items.
 */
export const UPDATE_REGISTRY_ENTRIES: readonly UpdateEntry[] = [];

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
