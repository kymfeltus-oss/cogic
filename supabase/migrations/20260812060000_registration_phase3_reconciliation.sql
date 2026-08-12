-- Phase 3: group-consistent refunds and audited payment reconciliation.

ALTER TABLE public.registration_groups DROP CONSTRAINT IF EXISTS registration_groups_status_check;
ALTER TABLE public.registration_groups ADD CONSTRAINT registration_groups_status_check
  CHECK (status IN ('draft','submitted','payment_pending','confirmed','canceled','refunded'));

CREATE TABLE IF NOT EXISTS public.registration_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
  group_id uuid NULL REFERENCES public.registration_groups(id) ON DELETE SET NULL,
  payment_id uuid NULL REFERENCES public.registration_payments(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('stripe_verify','webhook_replay','offline_check')),
  outcome text NOT NULL CHECK (outcome IN ('verified','fulfilled','recorded','rejected','failed')),
  stripe_session_id text NULL,
  stripe_payment_intent_id text NULL,
  external_reference text NULL,
  notes text NOT NULL CHECK (char_length(trim(notes)) >= 8),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS registration_reconciliations_registration_idx
  ON public.registration_reconciliations(registration_id, created_at DESC);
ALTER TABLE public.registration_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_reconciliations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_reconciliations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.registration_reconciliations TO service_role;

CREATE OR REPLACE FUNCTION public.record_offline_check_registration(
  p_actor_user_id uuid,
  p_registration_id uuid,
  p_reference text,
  p_notes text,
  p_expected_group_version integer,
  p_expected_member_versions jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_registration public.registrations%ROWTYPE;
  v_group public.registration_groups%ROWTYPE;
  v_payment public.registration_payments%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_count integer;
BEGIN
  IF p_actor_user_id IS NULL OR p_registration_id IS NULL THEN RAISE EXCEPTION 'actor and registration are required' USING ERRCODE='check_violation'; END IF;
  IF char_length(trim(COALESCE(p_reference,''))) < 3 OR char_length(trim(COALESCE(p_notes,''))) < 8 THEN RAISE EXCEPTION 'offline check reference and reconciliation notes are required' USING ERRCODE='check_violation'; END IF;
  SELECT * INTO v_registration FROM public.registrations WHERE id=p_registration_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'registration not found' USING ERRCODE='no_data_found'; END IF;
  IF v_registration.registration_group_id IS NULL THEN RAISE EXCEPTION 'offline reconciliation requires registration group' USING ERRCODE='check_violation'; END IF;
  SELECT * INTO v_group FROM public.registration_groups WHERE id=v_registration.registration_group_id FOR UPDATE;
  PERFORM public._assert_registration_group_version(v_group,p_expected_group_version);
  PERFORM 1 FROM public.registrations WHERE registration_group_id=v_group.id FOR UPDATE;
  PERFORM public._assert_registration_member_versions(v_group.id,p_expected_member_versions);
  IF v_group.status NOT IN ('submitted','payment_pending') THEN RAISE EXCEPTION 'offline check requires submitted group' USING ERRCODE='check_violation'; END IF;
  IF EXISTS(SELECT 1 FROM public.registration_payments WHERE registration_id=v_registration.id AND status='paid') THEN RAISE EXCEPTION 'paid Stripe payment already exists' USING ERRCODE='unique_violation'; END IF;
  INSERT INTO public.registration_payments(registration_id,status,amount_cents,currency,checkout_type)
    VALUES(v_registration.id,'paid',COALESCE(v_registration.amount_cents,0),COALESCE(v_registration.currency,'usd'),'registration') RETURNING * INTO v_payment;
  UPDATE public.registrations SET status='confirmed',confirmed_at=COALESCE(confirmed_at,v_now),updated_by=p_actor_user_id
    WHERE registration_group_id=v_group.id AND status IN ('submitted','payment_pending');
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count=0 THEN RAISE EXCEPTION 'no group members transitioned' USING ERRCODE='check_violation'; END IF;
  UPDATE public.registration_groups SET status='confirmed',wizard_metadata=COALESCE(wizard_metadata,'{}'::jsonb)||jsonb_build_object('offline_check_reference',trim(p_reference),'reconciled_at',v_now)
    WHERE id=v_group.id AND status IN ('submitted','payment_pending');
  IF NOT FOUND THEN RAISE EXCEPTION 'group transition drift' USING ERRCODE='serialization_failure'; END IF;
  INSERT INTO public.registration_reconciliations(registration_id,group_id,payment_id,action,outcome,external_reference,notes,actor_user_id)
    VALUES(v_registration.id,v_group.id,v_payment.id,'offline_check','recorded',trim(p_reference),trim(p_notes),p_actor_user_id);
  PERFORM public._registration_audit('registration.offline_check_recorded',v_registration.id,p_actor_user_id,COALESCE(v_registration.email,''),jsonb_build_object('group_id',v_group.id,'payment_id',v_payment.id,'reference',trim(p_reference),'notes',trim(p_notes)));
  RETURN jsonb_build_object('ok',true,'registration_id',v_registration.id,'group_id',v_group.id,'payment_id',v_payment.id,'status','confirmed');
END $$;
REVOKE ALL ON FUNCTION public.record_offline_check_registration(uuid,uuid,text,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_offline_check_registration(uuid,uuid,text,text,integer,jsonb) TO service_role;

-- Replace refund completion so the whole locked group, payment ledger, and credentials move together.
CREATE OR REPLACE FUNCTION public.complete_registration_group_refund(
  p_actor_user_id uuid, p_operation_id uuid, p_stripe_refund_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_op public.registration_refund_operations%ROWTYPE; v_now timestamptz:=timezone('utc',now()); v_count integer;
BEGIN
  SELECT * INTO v_op FROM public.registration_refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund operation not found' USING ERRCODE='no_data_found'; END IF;
  IF v_op.status='succeeded' THEN RETURN jsonb_build_object('ok',true,'idempotent',true,'operation_id',v_op.id,'status','succeeded'); END IF;
  IF v_op.status<>'submitted_to_stripe' OR trim(COALESCE(p_stripe_refund_id,''))='' THEN RAISE EXCEPTION 'refund operation is not completable' USING ERRCODE='check_violation'; END IF;
  PERFORM 1 FROM public.registration_groups WHERE id=v_op.group_id FOR UPDATE;
  PERFORM 1 FROM public.registrations WHERE registration_group_id=v_op.group_id FOR UPDATE;
  UPDATE public.registration_refund_operations SET status='succeeded',stripe_refund_id=trim(p_stripe_refund_id),failure_code=NULL,failure_message=NULL WHERE id=v_op.id;
  UPDATE public.registration_payments SET status='refunded',updated_at=v_now WHERE id=v_op.payment_id AND status='paid';
  UPDATE public.registrations SET status='refunded',refunded_at=COALESCE(refunded_at,v_now),updated_by=p_actor_user_id WHERE registration_group_id=v_op.group_id AND status='confirmed';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count=0 THEN RAISE EXCEPTION 'refund group member drift' USING ERRCODE='serialization_failure'; END IF;
  UPDATE public.registration_groups SET status='refunded',wizard_metadata=COALESCE(wizard_metadata,'{}'::jsonb)||jsonb_build_object('refunded_at',v_now,'refund_operation_id',v_op.id) WHERE id=v_op.group_id AND status='confirmed';
  IF NOT FOUND THEN RAISE EXCEPTION 'refund group status drift' USING ERRCODE='serialization_failure'; END IF;
  UPDATE public.registration_credentials SET status='revoked',revoked_at=COALESCE(revoked_at,v_now) WHERE registration_id IN (SELECT id FROM public.registrations WHERE registration_group_id=v_op.group_id) AND status IN ('issued','active');
  PERFORM public._registration_audit('registration.group_refunded',v_op.registration_id,p_actor_user_id,'',jsonb_build_object('group_id',v_op.group_id,'operation_id',v_op.id,'stripe_refund_id',trim(p_stripe_refund_id),'member_count',v_count));
  RETURN jsonb_build_object('ok',true,'idempotent',false,'operation_id',v_op.id,'registration_id',v_op.registration_id,'group_id',v_op.group_id,'status','succeeded','refunded_members',v_count);
END $$;
REVOKE ALL ON FUNCTION public.complete_registration_group_refund(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_registration_group_refund(uuid,uuid,text) TO service_role;
