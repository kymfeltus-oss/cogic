/** Attendee-safe stream experience keys (internal — labels shown in UI only). */

export type AttendeeExperienceKey =
  | "main_stage"
  | "crowd_xp"
  | "musician_xp"
  | "prayer_layer";

export const DEFAULT_ATTENDEE_EXPERIENCE: AttendeeExperienceKey = "main_stage";

export type AttendeeExperienceCatalogEntry = {
  label: string;
  description: string;
};

export const ATTENDEE_EXPERIENCE_CATALOG: Record<
  AttendeeExperienceKey,
  AttendeeExperienceCatalogEntry
> = {
  main_stage: {
    label: "Main Stage",
    description: "The primary live broadcast mix.",
  },
  crowd_xp: {
    label: "Crowd",
    description: "Feel the energy from the room.",
  },
  musician_xp: {
    label: "Musicians",
    description: "A closer view of the band and choir.",
  },
  prayer_layer: {
    label: "Prayer",
    description: "A focused view for prayer and ministry moments.",
  },
};

export const ALTERNATE_ATTENDEE_EXPERIENCE_KEYS: AttendeeExperienceKey[] = [
  "crowd_xp",
  "musician_xp",
  "prayer_layer",
];

export type AttendeeStreamFeedOption = {
  key: AttendeeExperienceKey;
  label: string;
  description: string;
};

export function isAttendeeExperienceKey(value: unknown): value is AttendeeExperienceKey {
  return (
    value === "main_stage" ||
    value === "crowd_xp" ||
    value === "musician_xp" ||
    value === "prayer_layer"
  );
}

export function buildAttendeeFeedOption(
  key: AttendeeExperienceKey,
): AttendeeStreamFeedOption {
  const entry = ATTENDEE_EXPERIENCE_CATALOG[key];
  return {
    key,
    label: entry.label,
    description: entry.description,
  };
}

export const EXPERIENCE_UNAVAILABLE_COPY =
  "This experience is temporarily unavailable. Returning to Main Stage.";
