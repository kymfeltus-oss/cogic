-- Complete the authoritative mobile registration entry gate, catalog, optional
-- commerce selections, communication preferences, and 2-night enforcement.

CREATE OR REPLACE FUNCTION public.acknowledge_registration_before_you_begin(
  p_owner_user_id uuid,
  p_program_key text,
  p_expected_group_version integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_group public.registration_groups%ROWTYPE;
BEGIN
  SELECT * INTO v_group FROM public.registration_groups
  WHERE owner_user_id = p_owner_user_id AND program_key = p_program_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'registration group not found' USING ERRCODE='P0002'; END IF;
  IF v_group.status <> 'draft' THEN RAISE EXCEPTION 'registration is not editable' USING ERRCODE='23514'; END IF;
  IF v_group.row_version <> p_expected_group_version THEN
    RAISE EXCEPTION 'registration group version changed' USING ERRCODE='40001';
  END IF;
  UPDATE public.registration_groups SET
    wizard_resume_step = GREATEST(wizard_resume_step, 1),
    wizard_metadata = COALESCE(wizard_metadata, '{}'::jsonb) || jsonb_build_object(
      'before_you_begin_acknowledged', true,
      'before_you_begin_acknowledged_at', timezone('utc', now())
    ),
    row_version = row_version + 1,
    updated_at = timezone('utc', now())
  WHERE id = v_group.id RETURNING * INTO v_group;
  RETURN jsonb_build_object('ok',true,'group_id',v_group.id,'group_version',v_group.row_version,'wizard_metadata',v_group.wizard_metadata);
END $$;
REVOKE ALL ON FUNCTION public.acknowledge_registration_before_you_begin(uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_registration_before_you_begin(uuid,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.save_registration_extras(
  p_owner_user_id uuid,
  p_program_key text,
  p_expected_group_version integer,
  p_musical_quantity integer,
  p_printed_program boolean,
  p_digital_program boolean,
  p_sms_opt_in boolean,
  p_email_opt_in boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_group public.registration_groups%ROWTYPE; v_ticket public.ticket_products%ROWTYPE;
  v_printed public.addon_products%ROWTYPE; v_digital public.addon_products%ROWTYPE; v_total integer;
BEGIN
  IF p_musical_quantity < 0 OR p_musical_quantity > 10 THEN RAISE EXCEPTION 'Musical ticket quantity must be between 0 and 10' USING ERRCODE='23514'; END IF;
  SELECT * INTO v_group FROM public.registration_groups WHERE owner_user_id=p_owner_user_id AND program_key=p_program_key FOR UPDATE;
  IF NOT FOUND OR v_group.status <> 'draft' THEN RAISE EXCEPTION 'registration draft not found' USING ERRCODE='P0002'; END IF;
  IF v_group.row_version <> p_expected_group_version THEN RAISE EXCEPTION 'registration group version changed' USING ERRCODE='40001'; END IF;
  SELECT * INTO v_ticket FROM public.ticket_products WHERE program_key=p_program_key AND product_key='MIDNIGHT_MUSICAL_TICKET_2026' AND active AND public;
  SELECT * INTO v_printed FROM public.addon_products WHERE program_key=p_program_key AND addon_key='PRINTED_PROGRAM_2026' AND active AND public;
  SELECT * INTO v_digital FROM public.addon_products WHERE program_key=p_program_key AND addon_key='DIGITAL_PROGRAM_2026' AND active AND public;
  IF p_musical_quantity > 0 AND (v_ticket.id IS NULL OR v_ticket.price_cents <> 3000) THEN RAISE EXCEPTION 'Musical Ticket is unavailable'; END IF;
  IF p_printed_program AND (v_printed.id IS NULL OR v_printed.price_cents <> 1000) THEN RAISE EXCEPTION 'Printed Program is unavailable'; END IF;
  IF p_digital_program AND (v_digital.id IS NULL OR v_digital.price_cents <> 0) THEN RAISE EXCEPTION 'Digital Program is unavailable'; END IF;
  v_total := p_musical_quantity * COALESCE(v_ticket.price_cents,3000) + CASE WHEN p_printed_program THEN v_printed.price_cents ELSE 0 END;
  UPDATE public.registration_groups SET
    wizard_metadata = COALESCE(wizard_metadata,'{}'::jsonb) || jsonb_build_object(
      'musical_ticket_product_id', CASE WHEN p_musical_quantity > 0 THEN v_ticket.id ELSE NULL END,
      'musical_ticket_quantity', p_musical_quantity,
      'musical_ticket_unit_cents', 3000,
      'printed_program_product_id', CASE WHEN p_printed_program THEN v_printed.id ELSE NULL END,
      'printed_program_selected', p_printed_program,
      'printed_program_unit_cents', 1000,
      'digital_program_product_id', CASE WHEN p_digital_program THEN v_digital.id ELSE NULL END,
      'digital_program_selected', p_digital_program,
      'digital_program_unit_cents', 0,
      'extras_total_cents', v_total,
      'sms_opt_in', p_sms_opt_in,
      'email_opt_in', p_email_opt_in,
      'communication_preferences_updated_at', timezone('utc',now())
    ), row_version=row_version+1, wizard_resume_step=GREATEST(wizard_resume_step,3), updated_at=timezone('utc',now())
  WHERE id=v_group.id RETURNING * INTO v_group;
  RETURN jsonb_build_object('ok',true,'group_id',v_group.id,'group_version',v_group.row_version,'extras_total_cents',v_total);
END $$;
REVOKE ALL ON FUNCTION public.save_registration_extras(uuid,text,integer,integer,boolean,boolean,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_registration_extras(uuid,text,integer,integer,boolean,boolean,boolean,boolean) TO service_role;

UPDATE public.registration_products SET
  name='Diamond Registration', price_cents=15000, active=true, public=true, sort_order=10,
  description='Reserved preferred seating at all convocation services, held up to 15 minutes after each service begins; a special gift; convention badge; hard copy of the Holy Convocation Program; access to Convention Housing Portal; community discounts.',
  eligibility_description='Required Registration for Bishops, Supervisors, Elected Officials, and Appointed Officials'
WHERE program_key='cogic-stream-2026' AND product_key='DIAMOND_REGISTRATION_2026';
UPDATE public.registration_products SET name='General Registration',price_cents=12500,active=true,public=true,sort_order=20,
  description='Access to all convocation services, with seating available minutes prior to service start; access to Convention Housing Portal; a special gift; convention badge; community discounts.'
WHERE program_key='cogic-stream-2026' AND product_key='GENERAL_REGISTRATION_2026';
UPDATE public.registration_products SET name='Jr. Registration Guest',price_cents=3500,active=true,public=true,sort_order=30,
  description='This allows the child (age 5-17) to sit in the same section as the parent/guardian. Child must be accompanied by a parent/guardian at all times. Includes a special gift and child identifying registration badge.',
  eligibility_description='Age 5–17; must be an eligible child with a parent/guardian in the same registration group.'
WHERE program_key='cogic-stream-2026' AND product_key='JUNIOR_REGISTRATION_GUEST_2026';
UPDATE public.registration_products SET name='2-Night Experience Pass',price_cents=2500,active=true,public=true,sort_order=40,
  description='Limited to a maximum two-night Convention Housing Portal stay. Includes the Digital Holy Convocation Program. No convention badge, special gift, printed program, preferred seating, or general full-convocation registration benefits are included.'
WHERE program_key='cogic-stream-2026' AND product_key='TWO_NIGHT_EXPERIENCE_PASS_2026';

DO $$ DECLARE v_occurrence uuid; v_entitlement uuid;
BEGIN
  SELECT eo.id INTO v_occurrence FROM public.event_occurrences eo JOIN public.events e ON e.id=eo.event_id
  WHERE e.program_key='cogic-stream-2026' AND e.event_type='midnight_musical' AND eo.status<>'canceled'
  ORDER BY eo.local_date NULLS LAST, eo.created_at LIMIT 1;
  IF v_occurrence IS NOT NULL THEN
    INSERT INTO public.access_entitlements(program_key,entitlement_key,name,entitlement_type,event_occurrence_id,access_zone,single_use,usage_limit,active)
    VALUES('cogic-stream-2026','MIDNIGHT_MUSICAL_ENTRY_2026','Midnight Musical Entry','event_access',v_occurrence,'musical',true,1,true)
    ON CONFLICT(program_key,entitlement_key) DO UPDATE SET event_occurrence_id=excluded.event_occurrence_id,active=true
    RETURNING id INTO v_entitlement;
    INSERT INTO public.ticket_products(program_key,event_occurrence_id,entitlement_id,product_key,name,description,price_cents,currency,capacity,per_order_limit,active,public,refundable,sort_order)
    VALUES('cogic-stream-2026',v_occurrence,v_entitlement,'MIDNIGHT_MUSICAL_TICKET_2026','Musical Ticket','Admission to the Midnight Musical. Include yourself in the ticket count.',3000,'usd',10000,10,true,true,false,10)
    ON CONFLICT(program_key,product_key) DO UPDATE SET event_occurrence_id=excluded.event_occurrence_id,entitlement_id=excluded.entitlement_id,name=excluded.name,description=excluded.description,price_cents=3000,capacity=GREATEST(public.ticket_products.capacity,excluded.capacity),per_order_limit=10,active=true,public=true;
  END IF;
END $$;

INSERT INTO public.access_entitlements(program_key,entitlement_key,name,entitlement_type,active)
VALUES('cogic-stream-2026','DIGITAL_PROGRAM_ADDON_2026','Digital Holy Convocation Program','content',true)
ON CONFLICT(program_key,entitlement_key) DO UPDATE SET active=true;
INSERT INTO public.addon_products(program_key,addon_key,name,description,price_cents,currency,included,max_quantity,active,public,fulfillment_type,entitlement_id)
VALUES('cogic-stream-2026','PRINTED_PROGRAM_2026','Printed Program','Optional printed Holy Convocation Program for pickup.',1000,'usd',false,1,true,true,'physical',null)
ON CONFLICT(program_key,addon_key) DO UPDATE SET name=excluded.name,description=excluded.description,price_cents=1000,max_quantity=1,active=true,public=true,fulfillment_type='physical';
INSERT INTO public.addon_products(program_key,addon_key,name,description,price_cents,currency,included,max_quantity,active,public,fulfillment_type,entitlement_id)
SELECT 'cogic-stream-2026','DIGITAL_PROGRAM_2026','Digital Program','Digital Holy Convocation Program entitlement.',0,'usd',true,1,true,true,'content',id
FROM public.access_entitlements WHERE program_key='cogic-stream-2026' AND entitlement_key='DIGITAL_PROGRAM_ADDON_2026'
ON CONFLICT(program_key,addon_key) DO UPDATE SET name=excluded.name,description=excluded.description,price_cents=0,included=true,max_quantity=1,active=true,public=true,fulfillment_type='content',entitlement_id=excluded.entitlement_id;

CREATE OR REPLACE FUNCTION public.enforce_two_night_registration_housing() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_key text;
BEGIN
  SELECT p.product_key INTO v_key FROM public.registrations r JOIN public.registration_products p ON p.id=r.registration_product_id
  WHERE r.id=NEW.primary_registration_id;
  IF v_key='TWO_NIGHT_EXPERIENCE_PASS_2026' AND COALESCE(NEW.stay_nights,NEW.departure_date-NEW.arrival_date,0)>2 THEN
    RAISE EXCEPTION '2-Night Experience Pass housing is limited to 2 nights' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS housing_requests_enforce_two_night_registration ON public.housing_requests;
CREATE TRIGGER housing_requests_enforce_two_night_registration BEFORE INSERT OR UPDATE ON public.housing_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_two_night_registration_housing();

CREATE OR REPLACE FUNCTION public.recalculate_two_night_housing_on_product_change() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_key text;
BEGIN
  IF NEW.registration_product_id IS DISTINCT FROM OLD.registration_product_id AND NEW.is_primary_registrant THEN
    SELECT product_key INTO v_key FROM public.registration_products WHERE id=NEW.registration_product_id;
    IF v_key='TWO_NIGHT_EXPERIENCE_PASS_2026' THEN
      UPDATE public.housing_requests SET status='canceled',updated_at=timezone('utc',now())
      WHERE primary_registration_id=NEW.id AND status<>'canceled' AND stay_nights>2;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS registrations_recalculate_two_night_housing ON public.registrations;
CREATE TRIGGER registrations_recalculate_two_night_housing AFTER UPDATE OF registration_product_id ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.recalculate_two_night_housing_on_product_change();
