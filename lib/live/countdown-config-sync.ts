/** Client poll interval — keep /live phase aligned with ops countdown edits. */
export const COUNTDOWN_CONFIG_SYNC_MS = 60_000;

/** Dispatched after ops saves countdown config so open /live tabs refetch immediately. */
export const COUNTDOWN_CONFIG_UPDATED_EVENT = "countdown-config-updated";
