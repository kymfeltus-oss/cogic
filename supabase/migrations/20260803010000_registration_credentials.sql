-- =============================================================================
-- 20260803010000_registration_credentials.sql
-- Phase 5A: Secure registration credential foundation (hash-only tokens)
-- Target project: wjlaaluonxiaxmytiqwi
-- Does NOT create public QR routes, scanner UI, or registration UI changes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- registration_credentials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registration_credentials (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id             uuid        NOT NULL REFERENCES public.registrations (id) ON DELETE RESTRICT,
  credential_version          integer     NOT NULL,
  status                      text        NOT NULL,
  token_hash                  bytea       NOT NULL,
  token_hash_version          smallint    NOT NULL DEFAULT 1,
  badge_code                  text        NULL,
  issued_at                   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  activated_at                timestamptz NULL,
  rotated_at                  timestamptz NULL,
  revoked_at                  timestamptz NULL,
  expires_at                  timestamptz NULL,
  replaced_by_credential_id   uuid        NULL REFERENCES public.registration_credentials (id) ON DELETE RESTRICT,
  revocation_reason           text        NULL,
  created_at                  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at                  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by                  uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by                  uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,

  CONSTRAINT registration_credentials_status_check CHECK (
    status IN ('issued', 'active', 'rotated', 'revoked', 'expired')
  ),
  CONSTRAINT registration_credentials_version_positive CHECK (credential_version > 0),
  CONSTRAINT registration_credentials_token_hash_sha256_len CHECK (octet_length(token_hash) = 32),
  CONSTRAINT registration_credentials_token_hash_version_positive CHECK (token_hash_version > 0),
  CONSTRAINT registration_credentials_expires_after_issued CHECK (
    expires_at IS NULL OR expires_at > issued_at
  ),
  CONSTRAINT registration_credentials_rotated_requires_fields CHECK (
    status <> 'rotated'
    OR (rotated_at IS NOT NULL AND replaced_by_credential_id IS NOT NULL)
  ),
  CONSTRAINT registration_credentials_revoked_requires_timestamp CHECK (
    status <> 'revoked' OR revoked_at IS NOT NULL
  ),
  CONSTRAINT registration_credentials_registration_version_uidx UNIQUE (registration_id, credential_version),
  CONSTRAINT registration_credentials_token_hash_uidx UNIQUE (token_hash),
  CONSTRAINT registration_credentials_badge_code_uidx UNIQUE (badge_code)
);

COMMENT ON TABLE public.registration_credentials IS
  'Hash-only Convocation credentials. Raw bearer tokens are never persisted.';
COMMENT ON COLUMN public.registration_credentials.token_hash IS
  'SHA-256 digest (32 bytes) of the opaque bearer token. Never store plaintext.';
COMMENT ON COLUMN public.registration_credentials.badge_code IS
  'Non-secret human support lookup code (CS26-XXXXXXXX). Never used as authentication.';

CREATE UNIQUE INDEX IF NOT EXISTS registration_credentials_one_usable_uidx
  ON public.registration_credentials (registration_id)
  WHERE status IN ('issued', 'active');

CREATE INDEX IF NOT EXISTS registration_credentials_registration_id_idx
  ON public.registration_credentials (registration_id);

CREATE INDEX IF NOT EXISTS registration_credentials_status_idx
  ON public.registration_credentials (status);

DROP TRIGGER IF EXISTS registration_credentials_set_updated_at ON public.registration_credentials;
CREATE TRIGGER registration_credentials_set_updated_at
  BEFORE UPDATE ON public.registration_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

-- Lifecycle transitions (terminal statuses cannot reactivate)
CREATE OR REPLACE FUNCTION public.validate_registration_credential_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('issued', 'active') THEN
      RAISE EXCEPTION
        'registration_credentials may only be inserted as issued or active (got %)',
        NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'active' THEN
      NEW.activated_at := COALESCE(NEW.activated_at, timezone('utc', now()));
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Terminal statuses cannot change.
  IF OLD.status IN ('rotated', 'revoked', 'expired') THEN
    RAISE EXCEPTION
      'terminal registration credential status cannot change: % → %',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  allowed := CASE
    WHEN OLD.status = 'issued' AND NEW.status IN ('active', 'rotated', 'revoked', 'expired') THEN true
    WHEN OLD.status = 'active' AND NEW.status IN ('rotated', 'revoked', 'expired') THEN true
    ELSE false
  END;

  IF NOT allowed THEN
    RAISE EXCEPTION
      'invalid registration credential status transition: % → %',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'active' AND OLD.status = 'issued' THEN
    NEW.activated_at := COALESCE(NEW.activated_at, timezone('utc', now()));
  END IF;

  IF NEW.status = 'rotated' THEN
    NEW.rotated_at := COALESCE(NEW.rotated_at, timezone('utc', now()));
  END IF;

  IF NEW.status = 'revoked' THEN
    NEW.revoked_at := COALESCE(NEW.revoked_at, timezone('utc', now()));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registration_credentials_validate_status_transition
  ON public.registration_credentials;
CREATE TRIGGER registration_credentials_validate_status_transition
  BEFORE INSERT OR UPDATE OF status ON public.registration_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_registration_credential_status_transition();

-- ---------------------------------------------------------------------------
-- credential_scan_events (append-only, privacy-minimized)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credential_scan_events (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id         uuid        NULL REFERENCES public.registration_credentials (id) ON DELETE SET NULL,
  occurred_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  outcome               text        NOT NULL,
  channel               text        NOT NULL,
  event_occurrence_id   uuid        NULL REFERENCES public.event_occurrences (id) ON DELETE SET NULL,
  scanner_user_id       uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  checkpoint_id         text        NULL,
  request_id            text        NULL,
  ip_hash               text        NULL,
  user_agent_family     text        NULL,
  metadata              jsonb       NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT credential_scan_events_outcome_check CHECK (
    outcome IN (
      'resolved',
      'invalid',
      'rotated',
      'revoked',
      'expired',
      'rate_limited',
      'validated',
      'picked_up',
      'checked_in'
    )
  ),
  CONSTRAINT credential_scan_events_channel_check CHECK (
    channel IN ('mobile_web', 'badge_pickup', 'admin_scanner')
  )
);

COMMENT ON TABLE public.credential_scan_events IS
  'Append-only privacy-minimized credential scan outcomes. Never stores tokens, hashes, or PII.';

CREATE INDEX IF NOT EXISTS credential_scan_events_credential_id_idx
  ON public.credential_scan_events (credential_id);
CREATE INDEX IF NOT EXISTS credential_scan_events_occurred_at_idx
  ON public.credential_scan_events (occurred_at DESC);

-- Block UPDATE/DELETE on scan events (append-only)
CREATE OR REPLACE FUNCTION public.prevent_credential_scan_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'credential_scan_events is append-only'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS credential_scan_events_no_update ON public.credential_scan_events;
CREATE TRIGGER credential_scan_events_no_update
  BEFORE UPDATE ON public.credential_scan_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_credential_scan_event_mutation();

DROP TRIGGER IF EXISTS credential_scan_events_no_delete ON public.credential_scan_events;
CREATE TRIGGER credential_scan_events_no_delete
  BEFORE DELETE ON public.credential_scan_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_credential_scan_event_mutation();

-- ---------------------------------------------------------------------------
-- RLS / grants — service_role only (no anon/authenticated table access)
-- ---------------------------------------------------------------------------
ALTER TABLE public.registration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.credential_scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credential_scan_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.registration_credentials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.credential_scan_events FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.registration_credentials TO service_role;
GRANT ALL ON public.credential_scan_events TO service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._credential_token_hash_from_hex(p_token_hash_hex text)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_token_hash_hex IS NULL
     OR p_token_hash_hex !~ '^[0-9a-fA-F]{64}$'
  THEN
    RAISE EXCEPTION 'token_hash_hex must be 64 hex characters'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN decode(lower(p_token_hash_hex), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public._credential_token_hash_from_hex(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._credential_token_hash_from_hex(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._credential_token_hash_from_hex(text) TO service_role;

-- ---------------------------------------------------------------------------
-- issue_registration_credential
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_registration_credential(
  p_registration_id uuid,
  p_token_hash_hex text,
  p_badge_code text,
  p_actor_user_id uuid DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_activate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registration public.registrations%ROWTYPE;
  v_token_hash bytea;
  v_next_version integer;
  v_status text;
  v_credential public.registration_credentials%ROWTYPE;
BEGIN
  IF p_registration_id IS NULL THEN
    RAISE EXCEPTION 'registration_id is required' USING ERRCODE = 'check_violation';
  END IF;

  IF p_badge_code IS NULL OR char_length(trim(p_badge_code)) = 0 THEN
    RAISE EXCEPTION 'badge_code is required' USING ERRCODE = 'check_violation';
  END IF;

  v_token_hash := public._credential_token_hash_from_hex(p_token_hash_hex);

  SELECT *
  INTO v_registration
  FROM public.registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_registration.status <> 'confirmed' THEN
    RAISE EXCEPTION
      'credentials may only be issued for confirmed registrations (status=%)',
      v_registration.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registration_credentials c
    WHERE c.registration_id = p_registration_id
      AND c.status IN ('issued', 'active')
  ) THEN
    RAISE EXCEPTION
      'usable credential already exists for registration %',
      p_registration_id
      USING ERRCODE = 'unique_violation';
  END IF;

  SELECT COALESCE(MAX(credential_version), 0) + 1
  INTO v_next_version
  FROM public.registration_credentials
  WHERE registration_id = p_registration_id;

  v_status := CASE WHEN p_activate THEN 'active' ELSE 'issued' END;

  INSERT INTO public.registration_credentials (
    registration_id,
    credential_version,
    status,
    token_hash,
    badge_code,
    expires_at,
    activated_at,
    created_by,
    updated_by
  ) VALUES (
    p_registration_id,
    v_next_version,
    v_status,
    v_token_hash,
    trim(p_badge_code),
    p_expires_at,
    CASE WHEN p_activate THEN timezone('utc', now()) ELSE NULL END,
    p_actor_user_id,
    p_actor_user_id
  )
  RETURNING * INTO v_credential;

  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    user_email,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    '300-awakening',
    COALESCE(p_actor_user_id, v_registration.user_id),
    v_registration.email,
    'credential.issued',
    'registration_credential',
    v_credential.id::text,
    jsonb_build_object(
      'registration_id', v_registration.id::text,
      'credential_version', v_credential.credential_version,
      'status', v_credential.status,
      'badge_code', v_credential.badge_code,
      'program_key', v_registration.program_key
    )
  );

  IF p_activate THEN
    INSERT INTO public.audit_logs (
      tenant_id,
      user_id,
      user_email,
      action,
      target_type,
      target_id,
      metadata
    ) VALUES (
      '300-awakening',
      COALESCE(p_actor_user_id, v_registration.user_id),
      v_registration.email,
      'credential.activated',
      'registration_credential',
      v_credential.id::text,
      jsonb_build_object(
        'registration_id', v_registration.id::text,
        'credential_version', v_credential.credential_version,
        'status', v_credential.status
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'credential_id', v_credential.id,
    'registration_id', v_registration.id,
    'credential_version', v_credential.credential_version,
    'status', v_credential.status,
    'badge_code', v_credential.badge_code,
    'issued_at', v_credential.issued_at,
    'activated_at', v_credential.activated_at,
    'expires_at', v_credential.expires_at
  );
END;
$$;

COMMENT ON FUNCTION public.issue_registration_credential(uuid, text, text, uuid, timestamptz, boolean) IS
  'Issue a hash-only registration credential for a confirmed registration. service_role only.';

REVOKE ALL ON FUNCTION public.issue_registration_credential(uuid, text, text, uuid, timestamptz, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_registration_credential(uuid, text, text, uuid, timestamptz, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_registration_credential(uuid, text, text, uuid, timestamptz, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- activate_registration_credential
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_registration_credential(
  p_credential_id uuid,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credential public.registration_credentials%ROWTYPE;
  v_registration public.registrations%ROWTYPE;
BEGIN
  SELECT *
  INTO v_credential
  FROM public.registration_credentials
  WHERE id = p_credential_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credential not found' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT *
  INTO v_registration
  FROM public.registrations
  WHERE id = v_credential.registration_id
  FOR UPDATE;

  IF v_registration.status <> 'confirmed' THEN
    RAISE EXCEPTION
      'cannot activate credential for non-confirmed registration (status=%)',
      v_registration.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_credential.status <> 'issued' THEN
    RAISE EXCEPTION
      'only issued credentials can be activated (status=%)',
      v_credential.status
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.registration_credentials
  SET
    status = 'active',
    updated_by = p_actor_user_id
  WHERE id = v_credential.id
  RETURNING * INTO v_credential;

  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    user_email,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    '300-awakening',
    COALESCE(p_actor_user_id, v_registration.user_id),
    v_registration.email,
    'credential.activated',
    'registration_credential',
    v_credential.id::text,
    jsonb_build_object(
      'registration_id', v_registration.id::text,
      'credential_version', v_credential.credential_version,
      'status', v_credential.status
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'credential_id', v_credential.id,
    'status', v_credential.status,
    'activated_at', v_credential.activated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_registration_credential(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_registration_credential(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_registration_credential(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- rotate_registration_credential
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rotate_registration_credential(
  p_registration_id uuid,
  p_token_hash_hex text,
  p_badge_code text,
  p_actor_user_id uuid DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_activate boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registration public.registrations%ROWTYPE;
  v_current public.registration_credentials%ROWTYPE;
  v_token_hash bytea;
  v_next_version integer;
  v_new_status text;
  v_new public.registration_credentials%ROWTYPE;
BEGIN
  IF p_badge_code IS NULL OR char_length(trim(p_badge_code)) = 0 THEN
    RAISE EXCEPTION 'badge_code is required' USING ERRCODE = 'check_violation';
  END IF;

  v_token_hash := public._credential_token_hash_from_hex(p_token_hash_hex);

  SELECT *
  INTO v_registration
  FROM public.registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_registration.status <> 'confirmed' THEN
    RAISE EXCEPTION
      'credentials may only be rotated for confirmed registrations (status=%)',
      v_registration.status
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_current
  FROM public.registration_credentials
  WHERE registration_id = p_registration_id
    AND status IN ('issued', 'active')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no usable credential to rotate' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT COALESCE(MAX(credential_version), 0) + 1
  INTO v_next_version
  FROM public.registration_credentials
  WHERE registration_id = p_registration_id;

  v_new_status := CASE WHEN p_activate THEN 'active' ELSE 'issued' END;

  -- Free the one-usable unique index first (self-ref satisfies rotated CHECK),
  -- then insert replacement, then point replaced_by at the new credential.
  UPDATE public.registration_credentials
  SET
    status = 'rotated',
    rotated_at = timezone('utc', now()),
    replaced_by_credential_id = v_current.id,
    updated_by = p_actor_user_id
  WHERE id = v_current.id;

  INSERT INTO public.registration_credentials (
    registration_id,
    credential_version,
    status,
    token_hash,
    badge_code,
    expires_at,
    activated_at,
    created_by,
    updated_by
  ) VALUES (
    p_registration_id,
    v_next_version,
    v_new_status,
    v_token_hash,
    trim(p_badge_code),
    p_expires_at,
    CASE WHEN p_activate THEN timezone('utc', now()) ELSE NULL END,
    p_actor_user_id,
    p_actor_user_id
  )
  RETURNING * INTO v_new;

  UPDATE public.registration_credentials
  SET
    replaced_by_credential_id = v_new.id,
    updated_by = p_actor_user_id
  WHERE id = v_current.id;

  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    user_email,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    '300-awakening',
    COALESCE(p_actor_user_id, v_registration.user_id),
    v_registration.email,
    'credential.rotated',
    'registration_credential',
    v_current.id::text,
    jsonb_build_object(
      'registration_id', v_registration.id::text,
      'from_version', v_current.credential_version,
      'to_credential_id', v_new.id::text,
      'to_version', v_new.credential_version,
      'new_status', v_new.status,
      'badge_code', v_new.badge_code
    )
  );

  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    user_email,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    '300-awakening',
    COALESCE(p_actor_user_id, v_registration.user_id),
    v_registration.email,
    'credential.issued',
    'registration_credential',
    v_new.id::text,
    jsonb_build_object(
      'registration_id', v_registration.id::text,
      'credential_version', v_new.credential_version,
      'status', v_new.status,
      'rotated_from', v_current.id::text,
      'badge_code', v_new.badge_code
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'previous_credential_id', v_current.id,
    'credential_id', v_new.id,
    'credential_version', v_new.credential_version,
    'status', v_new.status,
    'badge_code', v_new.badge_code,
    'rotated_at', timezone('utc', now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_registration_credential(uuid, text, text, uuid, timestamptz, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rotate_registration_credential(uuid, text, text, uuid, timestamptz, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_registration_credential(uuid, text, text, uuid, timestamptz, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- revoke_registration_credential
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_registration_credential(
  p_credential_id uuid,
  p_reason text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credential public.registration_credentials%ROWTYPE;
  v_registration public.registrations%ROWTYPE;
BEGIN
  SELECT *
  INTO v_credential
  FROM public.registration_credentials
  WHERE id = p_credential_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credential not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_credential.status NOT IN ('issued', 'active') THEN
    RAISE EXCEPTION
      'only issued/active credentials can be revoked (status=%)',
      v_credential.status
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_registration
  FROM public.registrations
  WHERE id = v_credential.registration_id;

  UPDATE public.registration_credentials
  SET
    status = 'revoked',
    revoked_at = timezone('utc', now()),
    revocation_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
    updated_by = p_actor_user_id
  WHERE id = v_credential.id
  RETURNING * INTO v_credential;

  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    user_email,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    '300-awakening',
    COALESCE(p_actor_user_id, v_registration.user_id),
    v_registration.email,
    'credential.revoked',
    'registration_credential',
    v_credential.id::text,
    jsonb_build_object(
      'registration_id', v_registration.id::text,
      'credential_version', v_credential.credential_version,
      'reason', v_credential.revocation_reason
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'credential_id', v_credential.id,
    'status', v_credential.status,
    'revoked_at', v_credential.revoked_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_registration_credential(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_registration_credential(uuid, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_registration_credential(uuid, text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- resolve_registration_credential (safe DTO only; no secrets / no IDs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_registration_credential(
  p_token_hash_hex text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash bytea;
  v_credential public.registration_credentials%ROWTYPE;
  v_registration public.registrations%ROWTYPE;
BEGIN
  BEGIN
    v_token_hash := public._credential_token_hash_from_hex(p_token_hash_hex);
  EXCEPTION
    WHEN others THEN
      RETURN jsonb_build_object('outcome', 'invalid');
  END;

  SELECT *
  INTO v_credential
  FROM public.registration_credentials
  WHERE token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  IF v_credential.expires_at IS NOT NULL
     AND v_credential.expires_at <= timezone('utc', now())
  THEN
    RETURN jsonb_build_object(
      'outcome', 'expired',
      'badge_code', v_credential.badge_code
    );
  END IF;

  IF v_credential.status = 'rotated' THEN
    RETURN jsonb_build_object('outcome', 'rotated', 'badge_code', v_credential.badge_code);
  END IF;

  IF v_credential.status = 'revoked' THEN
    RETURN jsonb_build_object('outcome', 'revoked', 'badge_code', v_credential.badge_code);
  END IF;

  IF v_credential.status = 'expired' THEN
    RETURN jsonb_build_object('outcome', 'expired', 'badge_code', v_credential.badge_code);
  END IF;

  IF v_credential.status NOT IN ('issued', 'active') THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  SELECT *
  INTO v_registration
  FROM public.registrations
  WHERE id = v_credential.registration_id;

  IF NOT FOUND OR v_registration.status <> 'confirmed' THEN
    RETURN jsonb_build_object('outcome', 'unavailable');
  END IF;

  -- Safe allowlisted fields only — no registration/credential UUIDs, no contact/payment data.
  RETURN jsonb_build_object(
    'outcome', 'resolved',
    'status', v_credential.status,
    'badge_code', v_credential.badge_code,
    'first_name', v_registration.first_name,
    'church_name', v_registration.church_name,
    'jurisdiction', v_registration.jurisdiction,
    'program_key', v_registration.program_key
  );
END;
$$;

COMMENT ON FUNCTION public.resolve_registration_credential(text) IS
  'Resolve a credential by SHA-256 hex hash. Returns sanitized fields only. service_role only.';

REVOKE ALL ON FUNCTION public.resolve_registration_credential(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_registration_credential(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_registration_credential(text) TO service_role;
