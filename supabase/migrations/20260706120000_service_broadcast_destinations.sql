-- Service-level broadcast destination selections for Today's Service
-- Rollback: supabase/migrations/20260706120000_service_broadcast_destinations.down.sql

CREATE TABLE IF NOT EXISTS public.service_broadcast_destinations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         text        NOT NULL,
  service_id        uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  platform          text        NOT NULL,
  destination_id    uuid        REFERENCES public.streaming_destinations (id) ON DELETE SET NULL,
  display_order     integer     NOT NULL DEFAULT 0,
  enabled           boolean     NOT NULL DEFAULT true,
  connected_account text,
  oauth_status      text        NOT NULL DEFAULT 'not_connected',
  last_tested_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT service_broadcast_destinations_platform_check CHECK (
    platform IN ('youtube', 'facebook', 'church_website', 'vimeo', 'twitch', 'custom_rtmp')
  ),
  CONSTRAINT service_broadcast_destinations_oauth_status_check CHECK (
    oauth_status IN ('not_connected', 'connected', 'expired', 'needs_attention', 'ready', 'error')
  ),
  CONSTRAINT service_broadcast_destinations_service_platform_unique UNIQUE (service_id, platform)
);

CREATE INDEX IF NOT EXISTS service_broadcast_destinations_service_idx
  ON public.service_broadcast_destinations (service_id);

CREATE INDEX IF NOT EXISTS service_broadcast_destinations_tenant_idx
  ON public.service_broadcast_destinations (tenant_id);

ALTER TABLE public.tenant_equipment_profiles
  ADD COLUMN IF NOT EXISTS recommended_broadcast_platform text NOT NULL DEFAULT 'youtube';

ALTER TABLE public.tenant_equipment_profiles DROP CONSTRAINT IF EXISTS tenant_equipment_profiles_recommended_broadcast_platform_check;
ALTER TABLE public.tenant_equipment_profiles
  ADD CONSTRAINT tenant_equipment_profiles_recommended_broadcast_platform_check CHECK (
    recommended_broadcast_platform IN ('youtube', 'facebook', 'church_website', 'vimeo', 'twitch', 'custom_rtmp')
  );

NOTIFY pgrst, 'reload schema';
