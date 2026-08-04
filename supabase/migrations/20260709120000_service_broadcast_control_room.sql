-- Production broadcast control room — service lifecycle + source/output fields

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS service_status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS playback_page_url text,
  ADD COLUMN IF NOT EXISTS primary_video_device_id text,
  ADD COLUMN IF NOT EXISTS primary_audio_device_id text,
  ADD COLUMN IF NOT EXISTS service_ended_at timestamptz;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_service_status_check;

ALTER TABLE public.services
  ADD CONSTRAINT services_service_status_check CHECK (
    service_status IN ('scheduled', 'preview', 'live', 'ended')
  );

COMMENT ON COLUMN public.services.playback_page_url IS 'Attendee viewer page (HTTPS) — not RTMP ingest.';
COMMENT ON COLUMN public.services.service_status IS 'Production lifecycle: scheduled | preview | live | ended';
