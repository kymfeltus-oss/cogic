-- Registration Hub Phase 1: durable credential issuance retry queue.
-- Payment confirmation is never rolled back when issuance fails.

CREATE TABLE IF NOT EXISTS public.registration_credential_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations (id) ON DELETE CASCADE,
  group_id uuid NULL REFERENCES public.registration_groups (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retry', 'completed', 'failed', 'canceled', 'dead')),
  attempt_count integer NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 5
    CHECK (max_attempts >= 1 AND max_attempts <= 25),
  next_attempt_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_error_code text NULL,
  last_error text NULL,
  terminal_reason text NULL,
  actor_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  last_attempt_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT registration_credential_jobs_dead_requires_reason CHECK (
    status <> 'dead' OR (terminal_reason IS NOT NULL AND char_length(trim(terminal_reason)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS registration_credential_jobs_one_open_per_registration_idx
  ON public.registration_credential_jobs (registration_id)
  WHERE status IN ('pending', 'processing', 'retry', 'failed');

CREATE INDEX IF NOT EXISTS registration_credential_jobs_due_idx
  ON public.registration_credential_jobs (next_attempt_at ASC)
  WHERE status IN ('pending', 'retry', 'failed');

DROP TRIGGER IF EXISTS registration_credential_jobs_set_updated_at ON public.registration_credential_jobs;
CREATE TRIGGER registration_credential_jobs_set_updated_at
  BEFORE UPDATE ON public.registration_credential_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE public.registration_credential_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_credential_jobs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_credential_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.registration_credential_jobs TO service_role;

COMMENT ON TABLE public.registration_credential_jobs IS
  'Durable retry queue for registration credential issuance. Never invents issued credentials.';

CREATE OR REPLACE FUNCTION public.enqueue_registration_credential_job(
  p_registration_id uuid,
  p_actor_user_id uuid DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registration public.registrations%ROWTYPE;
  v_existing public.registration_credential_jobs%ROWTYPE;
  v_has_usable boolean := false;
  v_job public.registration_credential_jobs%ROWTYPE;
  v_error_code text := NULLIF(trim(COALESCE(p_error_code, '')), '');
  v_error_message text := NULLIF(trim(COALESCE(p_error_message, '')), '');
BEGIN
  IF p_registration_id IS NULL THEN
    RAISE EXCEPTION 'enqueue_registration_credential_job requires registration_id'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_registration
  FROM public.registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration % not found', p_registration_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_registration.status <> 'confirmed' THEN
    RAISE EXCEPTION 'credential retry requires confirmed registration (status=%)', v_registration.status
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.registration_credentials
    WHERE registration_id = p_registration_id
      AND status IN ('issued', 'active')
  ) INTO v_has_usable;

  IF v_has_usable THEN
    UPDATE public.registration_credential_jobs
    SET
      status = 'completed',
      completed_at = COALESCE(completed_at, timezone('utc', now())),
      last_error = NULL,
      last_error_code = NULL,
      terminal_reason = NULL
    WHERE registration_id = p_registration_id
      AND status IN ('pending', 'processing', 'retry', 'failed')
    RETURNING * INTO v_job;

    RETURN jsonb_build_object(
      'ok', true,
      'enqueued', false,
      'already_issued', true,
      'job_id', COALESCE(v_job.id, gen_random_uuid()),
      'registration_id', p_registration_id,
      'group_id', v_registration.registration_group_id,
      'status', COALESCE(v_job.status, 'completed'),
      'attempt_count', COALESCE(v_job.attempt_count, 0),
      'next_attempt_at', COALESCE(v_job.next_attempt_at, timezone('utc', now()))
    );
  END IF;

  SELECT *
  INTO v_existing
  FROM public.registration_credential_jobs
  WHERE registration_id = p_registration_id
    AND status IN ('pending', 'processing', 'retry', 'failed')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.registration_credential_jobs
    SET
      status = CASE WHEN status = 'processing' THEN status ELSE 'pending' END,
      next_attempt_at = LEAST(next_attempt_at, timezone('utc', now())),
      last_error_code = COALESCE(v_error_code, last_error_code),
      last_error = COALESCE(v_error_message, last_error),
      actor_user_id = COALESCE(p_actor_user_id, actor_user_id),
      group_id = COALESCE(group_id, v_registration.registration_group_id)
    WHERE id = v_existing.id
    RETURNING * INTO v_job;

    RETURN jsonb_build_object(
      'ok', true,
      'enqueued', false,
      'idempotent', true,
      'job_id', v_job.id,
      'registration_id', v_job.registration_id,
      'group_id', v_job.group_id,
      'status', v_job.status,
      'attempt_count', v_job.attempt_count,
      'next_attempt_at', v_job.next_attempt_at
    );
  END IF;

  INSERT INTO public.registration_credential_jobs (
    registration_id,
    group_id,
    status,
    attempt_count,
    max_attempts,
    next_attempt_at,
    last_error_code,
    last_error,
    actor_user_id
  ) VALUES (
    p_registration_id,
    v_registration.registration_group_id,
    'pending',
    0,
    5,
    timezone('utc', now()),
    v_error_code,
    v_error_message,
    p_actor_user_id
  )
  RETURNING * INTO v_job;

  RETURN jsonb_build_object(
    'ok', true,
    'enqueued', true,
    'idempotent', false,
    'job_id', v_job.id,
    'registration_id', v_job.registration_id,
    'group_id', v_job.group_id,
    'status', v_job.status,
    'attempt_count', v_job.attempt_count,
    'next_attempt_at', v_job.next_attempt_at
  );
END;
$$;

DROP FUNCTION IF EXISTS public.enqueue_registration_credential_job(uuid, uuid, text);
REVOKE ALL ON FUNCTION public.enqueue_registration_credential_job(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_registration_credential_job(uuid, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_registration_credential_job(uuid, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_registration_credential_jobs(
  p_limit integer DEFAULT 25
)
RETURNS SETOF public.registration_credential_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id
    FROM public.registration_credential_jobs
    WHERE status IN ('pending', 'retry', 'failed')
      AND next_attempt_at <= timezone('utc', now())
    ORDER BY next_attempt_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE public.registration_credential_jobs jobs
  SET
    status = 'processing',
    attempt_count = attempt_count + 1,
    last_attempt_at = timezone('utc', now())
  FROM due
  WHERE jobs.id = due.id
  RETURNING jobs.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_registration_credential_jobs(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_registration_credential_jobs(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_registration_credential_jobs(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_registration_credential_job(
  p_job_id uuid,
  p_outcome text,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_retry_delay_seconds integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.registration_credential_jobs%ROWTYPE;
  v_outcome text := lower(trim(COALESCE(p_outcome, '')));
  v_delay integer := GREATEST(5, LEAST(COALESCE(p_retry_delay_seconds, 60), 3600));
  v_error_code text := NULLIF(trim(COALESCE(p_error_code, '')), '');
  v_error_message text := NULLIF(trim(COALESCE(p_error_message, '')), '');
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'complete_registration_credential_job requires job_id'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_job
  FROM public.registration_credential_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credential job % not found', p_job_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_outcome IN ('succeeded', 'completed') THEN
    UPDATE public.registration_credential_jobs
    SET
      status = 'completed',
      completed_at = timezone('utc', now()),
      last_error = NULL,
      last_error_code = NULL,
      terminal_reason = NULL
    WHERE id = p_job_id
    RETURNING * INTO v_job;
  ELSIF v_outcome = 'retry' THEN
    IF v_job.attempt_count >= v_job.max_attempts THEN
      UPDATE public.registration_credential_jobs
      SET
        status = 'dead',
        last_error_code = COALESCE(v_error_code, last_error_code, 'max_attempts'),
        last_error = COALESCE(v_error_message, last_error, 'max attempts exceeded'),
        terminal_reason = 'max_attempts_exceeded'
      WHERE id = p_job_id
      RETURNING * INTO v_job;
    ELSE
      UPDATE public.registration_credential_jobs
      SET
        status = 'retry',
        last_error_code = v_error_code,
        last_error = v_error_message,
        next_attempt_at = timezone('utc', now()) + make_interval(secs => v_delay)
      WHERE id = p_job_id
      RETURNING * INTO v_job;
    END IF;
  ELSIF v_outcome IN ('dead', 'failed') THEN
    UPDATE public.registration_credential_jobs
    SET
      status = CASE WHEN v_outcome = 'failed' AND attempt_count < max_attempts THEN 'failed' ELSE 'dead' END,
      last_error_code = COALESCE(v_error_code, last_error_code, 'terminal'),
      last_error = COALESCE(v_error_message, last_error, 'terminal failure'),
      terminal_reason = CASE
        WHEN v_outcome = 'failed' AND attempt_count < max_attempts THEN NULL
        ELSE COALESCE(v_error_code, 'terminal_failure')
      END,
      next_attempt_at = CASE
        WHEN v_outcome = 'failed' AND attempt_count < max_attempts
          THEN timezone('utc', now()) + make_interval(secs => v_delay)
        ELSE next_attempt_at
      END
    WHERE id = p_job_id
    RETURNING * INTO v_job;
  ELSE
    RAISE EXCEPTION 'complete_registration_credential_job outcome must be completed|retry|failed|dead'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'job_id', v_job.id,
    'registration_id', v_job.registration_id,
    'group_id', v_job.group_id,
    'status', v_job.status,
    'attempt_count', v_job.attempt_count,
    'next_attempt_at', v_job.next_attempt_at,
    'terminal_reason', v_job.terminal_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_registration_credential_job(uuid, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_registration_credential_job(uuid, text, text, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_registration_credential_job(uuid, text, text, text, integer) TO service_role;
