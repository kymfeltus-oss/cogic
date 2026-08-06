-- =============================================================================
-- 20260804120000_add_general_assembly_event_type.sql
-- COGIC STREAM — General Assembly first-class event type (Phase 6B)
-- Target project: wjlaaluonxiaxmytiqwi
-- =============================================================================
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_type_check;
ALTER TABLE public.events ADD CONSTRAINT events_event_type_check CHECK (
  event_type IN (
    'main_service',
    'revival_fire',
    'midnight_musical',
    'main_event_center_class',
    'morning_manna',
    'midday_worship',
    'special_event',
    'general_assembly'
  )
);
INSERT INTO public.events (
  program_key,
  slug,
  title,
  event_type,
  status,
  sort_order,
  description
)
VALUES (
  'cogic-stream-2026',
  'general-assembly',
  'General Assembly',
  'general_assembly',
  'draft',
  35,
  'Official General Assembly sessions of the 118th Holy Convocation.'
)
ON CONFLICT (program_key, slug) DO NOTHING;
