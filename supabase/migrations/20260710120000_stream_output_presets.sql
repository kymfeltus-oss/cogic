-- Stream method presets + active method on services (production control room)

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS active_stream_method text;

COMMENT ON COLUMN public.services.active_stream_method IS
  'Active production stream method: church_website | custom_rtmp | obs_vmix | youtube | facebook | vimeo | twitch';

CREATE TABLE IF NOT EXISTS public.stream_output_presets (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id            uuid        REFERENCES public.services (id) ON DELETE CASCADE,
  tenant_id             text        NOT NULL DEFAULT '300-awakening',
  method                text        NOT NULL,
  label                 text,
  rtmp_url              text,
  encrypted_stream_key  text,
  playback_page_url     text,
  is_default            boolean     NOT NULL DEFAULT false,
  is_enabled            boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at            timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT stream_output_presets_method_check CHECK (
    method IN (
      'church_website',
      'custom_rtmp',
      'obs_vmix',
      'youtube',
      'facebook',
      'vimeo',
      'twitch'
    )
  )
);

CREATE INDEX IF NOT EXISTS stream_output_presets_tenant_idx
  ON public.stream_output_presets (tenant_id);

CREATE INDEX IF NOT EXISTS stream_output_presets_service_idx
  ON public.stream_output_presets (service_id)
  WHERE service_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stream_output_presets_tenant_default_method_idx
  ON public.stream_output_presets (tenant_id, method)
  WHERE service_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stream_output_presets_service_method_idx
  ON public.stream_output_presets (tenant_id, service_id, method)
  WHERE service_id IS NOT NULL;

COMMENT ON TABLE public.stream_output_presets IS
  'Per-method stream output defaults/overrides; secrets also synced to streaming_destinations.';
