-- =============================================================================
-- Incident events + audit logs for production incident monitoring
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.incident_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     text        NOT NULL DEFAULT '300-awakening',
  stream_id     text,
  worker_id     text,
  user_id       uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  user_email    text,
  source        text        NOT NULL,
  action        text        NOT NULL,
  target        text        NOT NULL,
  severity      text        NOT NULL DEFAULT 'info',
  status        text        NOT NULL DEFAULT 'open',
  description   text        NOT NULL DEFAULT '',
  payload_json  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  snapshot_url  text,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  reviewed_at   timestamptz,
  reviewed_by   uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  escalated_at  timestamptz,
  resolved_at   timestamptz,
  resolved_by   uuid        REFERENCES auth.users (id) ON DELETE SET NULL,

  CONSTRAINT incident_events_tenant_not_blank CHECK (char_length(trim(tenant_id)) > 0),
  CONSTRAINT incident_events_source_check CHECK (
    source IN (
      'console', 'preshow', 'camera', 'worker', 'ffmpeg', 'destination',
      'recording', 'auth', 'system', 'api_gateway'
    )
  ),
  CONSTRAINT incident_events_severity_check CHECK (
    severity IN ('critical', 'warning', 'info')
  ),
  CONSTRAINT incident_events_status_check CHECK (
    status IN ('open', 'reviewed', 'escalated', 'resolved')
  ),
  CONSTRAINT incident_events_action_not_blank CHECK (char_length(trim(action)) > 0),
  CONSTRAINT incident_events_target_not_blank CHECK (char_length(trim(target)) > 0)
);

CREATE INDEX IF NOT EXISTS incident_events_tenant_created_idx
  ON public.incident_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS incident_events_tenant_severity_idx
  ON public.incident_events (tenant_id, severity);

CREATE INDEX IF NOT EXISTS incident_events_tenant_status_idx
  ON public.incident_events (tenant_id, status);

CREATE INDEX IF NOT EXISTS incident_events_tenant_source_idx
  ON public.incident_events (tenant_id, source);

CREATE UNIQUE INDEX IF NOT EXISTS incident_events_access_log_dedupe_idx
  ON public.incident_events ((payload_json ->> 'access_log_id'))
  WHERE payload_json ? 'access_log_id';

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text        NOT NULL DEFAULT '300-awakening',
  user_id     uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  user_email  text,
  action      text        NOT NULL,
  target_type text        NOT NULL,
  target_id   text,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT audit_logs_action_not_blank CHECK (char_length(trim(action)) > 0),
  CONSTRAINT audit_logs_target_type_not_blank CHECK (char_length(trim(target_type)) > 0)
);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx
  ON public.audit_logs (tenant_id, created_at DESC);

ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.incident_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.incident_events TO service_role;
GRANT ALL ON public.audit_logs TO service_role;

-- Backfill real stream access audit rows (not synthetic demo data).
INSERT INTO public.incident_events (
  tenant_id,
  user_id,
  source,
  action,
  target,
  severity,
  status,
  description,
  payload_json,
  created_at
)
SELECT
  '300-awakening',
  sal.user_id,
  'auth',
  sal.result,
  sal.reason,
  CASE
    WHEN sal.result = 'denied' THEN 'warning'
    ELSE 'info'
  END,
  'open',
  sal.reason,
  jsonb_build_object(
    'access_log_id', sal.id::text,
    'ip', sal.ip,
    'user_agent', sal.user_agent,
    'synced_from', 'stream_access_logs'
  ),
  sal.created_at
FROM public.stream_access_logs sal
WHERE NOT EXISTS (
  SELECT 1
  FROM public.incident_events ie
  WHERE ie.payload_json ->> 'access_log_id' = sal.id::text
);

COMMENT ON TABLE public.incident_events IS
  'Production incident and safety events for live broadcast operations.';
COMMENT ON TABLE public.audit_logs IS
  'RBAC and operator audit trail for incident review actions.';
