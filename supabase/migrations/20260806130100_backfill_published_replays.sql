-- Preserve the existing published-occurrence contract when introducing the
-- explicit recording lifecycle. No recordings are created by this backfill.
UPDATE public.past_broadcast_recordings r
SET publication_status = 'published',
    published_at = COALESCE(r.published_at, r.updated_at)
WHERE r.recording_url IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.event_occurrences o
    JOIN public.events e ON e.id = o.event_id
    WHERE o.replay_recording_id = r.id
      AND o.visibility = 'published'
      AND o.status <> 'canceled'
      AND e.status = 'published'
  )
  AND r.publication_status = 'ready';
