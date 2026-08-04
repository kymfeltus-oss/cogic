/** True when Supabase/Postgres reports a missing column or stale schema cache. */
export function isFellowshipSchemaMismatchError(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false;

  const message = error.message ?? "";
  const code = error.code ?? "";

  return (
    code === "PGRST204" ||
    code === "42703" ||
    /column .+ does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
}

export const FELLOWSHIP_MESSAGE_SELECT_FULL =
  "id, user_id, email, content, created_at, deleted_at, is_pinned, pinned_at";

export const FELLOWSHIP_MESSAGE_SELECT_LEGACY =
  "id, user_id, email, content, created_at";
