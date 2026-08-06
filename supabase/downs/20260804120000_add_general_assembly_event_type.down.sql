-- Down: remove general_assembly event type (Phase 6B)
-- Target: wjlaaluonxiaxmytiqwi
DELETE FROM public.events
WHERE program_key = 'cogic-stream-2026'
  AND slug = 'general-assembly'
  AND event_type = 'general_assembly';
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_type_check;
ALTER TABLE public.events ADD CONSTRAINT events_event_type_check CHECK (
  event_type IN (
    'main_service',
    'revival_fire',
    'midnight_musical',
    'main_event_center_class',
    'morning_manna',
    'midday_worship',
    'special_event'
  )
);
