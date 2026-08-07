-- Registration Slice 5: server-authoritative access control and door operations.
-- No events, zones, staff, credentials, attendees, or demo scans are seeded.

CREATE TABLE public.staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK(permission IN('CHECK_IN')), active boolean NOT NULL DEFAULT true,
  assigned_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,permission)
);
CREATE TABLE public.access_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_key text NOT NULL DEFAULT 'cogic-stream-2026', zone_key text NOT NULL,
  name text NOT NULL, description text NULL, active boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL, updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(zone_key ~ '^[A-Z][A-Z0-9_]{1,63}$'), UNIQUE(program_key,zone_key)
);
CREATE TABLE public.occurrence_access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_occurrence_id uuid NOT NULL REFERENCES public.event_occurrences(id) ON DELETE CASCADE,
  access_zone_id uuid NOT NULL REFERENCES public.access_zones(id) ON DELETE RESTRICT,
  entitlement_id uuid NULL REFERENCES public.access_entitlements(id) ON DELETE RESTRICT,
  access_mode text NOT NULL CHECK(access_mode IN('REGISTRATION','TICKET','PROGRAM_CHECK_IN')),
  usage_mode text NOT NULL DEFAULT 'REENTRY_ALLOWED' CHECK(usage_mode IN('SINGLE_ENTRY','REENTRY_ALLOWED')),
  allow_general_fallback boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL, updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(event_occurrence_id,access_zone_id)
);
CREATE TABLE public.access_scan_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, program_key text NOT NULL, credential_type text NOT NULL CHECK(credential_type IN('registration','ticket','unknown')),
  credential_id uuid NULL, registration_id uuid NULL REFERENCES public.registrations(id) ON DELETE SET NULL,
  ticket_id uuid NULL REFERENCES public.ticket_instances(id) ON DELETE SET NULL, attendee_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  event_occurrence_id uuid NOT NULL REFERENCES public.event_occurrences(id) ON DELETE RESTRICT,
  access_zone_id uuid NOT NULL REFERENCES public.access_zones(id) ON DELETE RESTRICT, scanner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  scanned_at timestamptz NOT NULL DEFAULT now(), decision text NOT NULL CHECK(decision IN('ALLOWED','DENIED','ALLOWED_WITH_CONDITION','VALIDATION_UNAVAILABLE')),
  reason_code text NOT NULL, entitlement_id uuid NULL REFERENCES public.access_entitlements(id) ON DELETE SET NULL,
  prior_use_at timestamptz NULL, entry_recorded boolean NOT NULL DEFAULT false, input_method text NOT NULL CHECK(input_method IN('camera','manual')),
  CHECK(reason_code IN('VALID_REGISTRATION','VALID_TICKET','PREFERRED_SEATING','GENERAL_SEATING','PREFERRED_WINDOW_EXPIRED','MUSICAL_TICKET_REQUIRED','WRONG_EVENT','WRONG_ZONE','CREDENTIAL_REVOKED','REGISTRATION_CANCELED','PAYMENT_NOT_CONFIRMED','TICKET_REVOKED','TICKET_ALREADY_USED','ENTITLEMENT_EXPIRED','GUARDIAN_REQUIRED','NOT_YET_VALID','INVALID_CREDENTIAL','NO_APPLICABLE_ENTITLEMENT'))
);
CREATE TABLE public.check_ins (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, scan_attempt_id bigint NOT NULL UNIQUE REFERENCES public.access_scan_attempts(id) ON DELETE RESTRICT,
  registration_id uuid NULL REFERENCES public.registrations(id) ON DELETE SET NULL, ticket_id uuid NULL REFERENCES public.ticket_instances(id) ON DELETE SET NULL,
  event_occurrence_id uuid NOT NULL REFERENCES public.event_occurrences(id) ON DELETE RESTRICT, access_zone_id uuid NOT NULL REFERENCES public.access_zones(id) ON DELETE RESTRICT,
  scanner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, checked_in_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX access_scans_recent_idx ON public.access_scan_attempts(program_key,scanned_at DESC);
CREATE INDEX access_scans_occurrence_idx ON public.access_scan_attempts(event_occurrence_id,access_zone_id,scanned_at DESC);
CREATE UNIQUE INDEX check_ins_registration_single_idx ON public.check_ins(registration_id,event_occurrence_id,access_zone_id) WHERE registration_id IS NOT NULL;
CREATE UNIQUE INDEX check_ins_ticket_single_idx ON public.check_ins(ticket_id,event_occurrence_id,access_zone_id) WHERE ticket_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.process_access_scan(p_token_hash_hex text,p_reference text,p_occurrence_id uuid,p_zone_id uuid,p_scanner_user_id uuid,p_input_method text,p_guardian_present boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h bytea; rule record; regcred record; reg record; ent record; tickcred record; tick record;
  decision text:='DENIED'; reason text:='INVALID_CREDENTIAL'; ctype text:='unknown'; cid uuid; rid uuid; tid uuid; uid uuid; eid uuid; prior timestamptz; scan_id bigint; entry_ok boolean:=false; preferred_until timestamptz;
BEGIN
  IF p_input_method NOT IN('camera','manual') THEN RAISE EXCEPTION 'Invalid input method'; END IF;
  SELECT r.*,o.scheduled_start_at,o.event_id,e.event_type,z.zone_key INTO rule FROM occurrence_access_rules r JOIN event_occurrences o ON o.id=r.event_occurrence_id JOIN events e ON e.id=o.event_id JOIN access_zones z ON z.id=r.access_zone_id WHERE r.event_occurrence_id=p_occurrence_id AND r.access_zone_id=p_zone_id AND r.active AND z.active AND o.visibility='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Access point is not configured'; END IF;
  IF p_token_hash_hex ~ '^[0-9a-fA-F]{64}$' THEN h:=decode(lower(p_token_hash_hex),'hex'); END IF;

  SELECT c.* INTO regcred FROM registration_credentials c WHERE (h IS NOT NULL AND c.token_hash=h) OR (p_reference<>'' AND c.badge_code=p_reference) ORDER BY c.issued_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    ctype:='registration'; cid:=regcred.id; rid:=regcred.registration_id;
    SELECT r.*,rp.name product_name INTO reg FROM registrations r LEFT JOIN registration_products rp ON rp.id=r.registration_product_id WHERE r.id=rid FOR UPDATE; uid:=reg.user_id;
    IF regcred.status NOT IN('issued','active') OR (regcred.expires_at IS NOT NULL AND regcred.expires_at<=now()) THEN reason:='CREDENTIAL_REVOKED';
    ELSIF reg.status='canceled' OR reg.status='refunded' THEN reason:='REGISTRATION_CANCELED';
    ELSIF reg.status<>'confirmed' THEN reason:='PAYMENT_NOT_CONFIRMED';
    ELSIF rule.access_mode='TICKET' THEN reason:='MUSICAL_TICKET_REQUIRED';
    ELSE
      SELECT ae.*,a.id owned_id,a.status owned_status,a.uses_consumed,a.guardian_registration_id,COALESCE(a.valid_from,ae.valid_from) owned_from,COALESCE(a.valid_until,ae.valid_until) owned_until
      INTO ent FROM attendee_entitlements a JOIN access_entitlements ae ON ae.id=a.entitlement_id
      WHERE a.registration_id=rid AND a.status='active' AND ae.active AND (rule.entitlement_id IS NULL OR ae.id=rule.entitlement_id)
        AND (ae.event_occurrence_id IS NULL OR ae.event_occurrence_id=p_occurrence_id) AND (ae.event_id IS NULL OR ae.event_id=rule.event_id) AND (ae.event_type IS NULL OR ae.event_type=rule.event_type)
      ORDER BY CASE WHEN ae.entitlement_type='seating' THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE OF a;
      IF NOT FOUND THEN reason:='WRONG_ZONE';
      ELSIF ent.owned_from IS NOT NULL AND now()<ent.owned_from THEN reason:='NOT_YET_VALID'; eid:=ent.id;
      ELSIF ent.owned_until IS NOT NULL AND now()>ent.owned_until THEN reason:='ENTITLEMENT_EXPIRED'; eid:=ent.id;
      ELSIF ent.guardian_required AND (NOT p_guardian_present OR ent.guardian_registration_id IS NULL OR NOT EXISTS(SELECT 1 FROM registrations g WHERE g.id=ent.guardian_registration_id AND g.status='confirmed')) THEN reason:='GUARDIAN_REQUIRED'; eid:=ent.id;
      ELSE
        eid:=ent.id; decision:='ALLOWED'; reason:=CASE WHEN rule.access_mode='PROGRAM_CHECK_IN' THEN 'VALID_REGISTRATION' WHEN ent.entitlement_type='seating' THEN 'PREFERRED_SEATING' WHEN rule.zone_key='GENERAL_ENTRY' THEN 'GENERAL_SEATING' ELSE 'VALID_REGISTRATION' END;
        IF ent.entitlement_type='seating' AND ent.preferred_hold_minutes IS NOT NULL THEN preferred_until:=rule.scheduled_start_at + make_interval(mins=>ent.preferred_hold_minutes); IF now()>preferred_until THEN decision:='ALLOWED_WITH_CONDITION';reason:='PREFERRED_WINDOW_EXPIRED'; END IF; END IF;
        IF rule.usage_mode='SINGLE_ENTRY' THEN SELECT checked_in_at INTO prior FROM check_ins WHERE registration_id=rid AND event_occurrence_id=p_occurrence_id AND access_zone_id=p_zone_id; IF prior IS NOT NULL THEN decision:='DENIED';reason:='TICKET_ALREADY_USED'; END IF; END IF;
      END IF;
    END IF;
  ELSE
    SELECT c.* INTO tickcred FROM ticket_credentials c WHERE (h IS NOT NULL AND c.token_hash=h) OR (p_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AND c.ticket_id::text=lower(p_reference)) LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      ctype:='ticket';cid:=tickcred.id;tid:=tickcred.ticket_id;
      SELECT t.*,tp.event_occurrence_id,tp.entitlement_id,tp.name product_name INTO tick FROM ticket_instances t JOIN ticket_products tp ON tp.id=t.ticket_product_id WHERE t.id=tid FOR UPDATE;uid:=COALESCE(tick.assigned_user_id,tick.purchaser_user_id);eid:=tick.entitlement_id;prior:=tick.used_at;
      IF tickcred.status<>'active' OR tick.status IN('revoked','refunded','expired') THEN reason:='TICKET_REVOKED';
      ELSIF tick.event_occurrence_id<>p_occurrence_id THEN reason:='WRONG_EVENT';
      ELSIF rule.access_mode<>'TICKET' OR (rule.entitlement_id IS NOT NULL AND rule.entitlement_id<>tick.entitlement_id) THEN reason:='WRONG_ZONE';
      ELSIF rule.usage_mode='SINGLE_ENTRY' AND (tick.status='used' OR tick.used_at IS NOT NULL) THEN reason:='TICKET_ALREADY_USED';
      ELSIF tick.status<>'valid' THEN reason:='MUSICAL_TICKET_REQUIRED';
      ELSE decision:='ALLOWED';reason:='VALID_TICKET'; IF rule.usage_mode='SINGLE_ENTRY' THEN UPDATE ticket_instances SET status='used',used_at=now(),updated_at=now() WHERE id=tid; END IF; END IF;
    END IF;
  END IF;
  INSERT INTO access_scan_attempts(program_key,credential_type,credential_id,registration_id,ticket_id,attendee_user_id,event_occurrence_id,access_zone_id,scanner_user_id,decision,reason_code,entitlement_id,prior_use_at,input_method)
  VALUES('cogic-stream-2026',ctype,cid,rid,tid,uid,p_occurrence_id,p_zone_id,p_scanner_user_id,decision,reason,eid,prior,p_input_method) RETURNING id INTO scan_id;
  IF decision IN('ALLOWED','ALLOWED_WITH_CONDITION') THEN
    BEGIN INSERT INTO check_ins(scan_attempt_id,registration_id,ticket_id,event_occurrence_id,access_zone_id,scanner_user_id) VALUES(scan_id,rid,tid,p_occurrence_id,p_zone_id,p_scanner_user_id);entry_ok:=true;
    EXCEPTION WHEN unique_violation THEN decision:='DENIED';reason:='TICKET_ALREADY_USED';UPDATE access_scan_attempts SET decision=decision,reason_code=reason,prior_use_at=(SELECT max(checked_in_at) FROM check_ins WHERE (registration_id=rid OR ticket_id=tid) AND event_occurrence_id=p_occurrence_id AND access_zone_id=p_zone_id) WHERE id=scan_id; END;
  END IF;
  UPDATE access_scan_attempts SET entry_recorded=entry_ok WHERE id=scan_id;
  RETURN jsonb_build_object('scanId',scan_id,'decision',decision,'reasonCode',reason,'credentialType',ctype,'registrationId',rid,'ticketId',tid,'attendeeUserId',uid,'entitlementId',eid,'priorUseAt',prior,'preferredUntil',preferred_until,'entryRecorded',entry_ok,'attendeeName',CASE WHEN ctype='registration' THEN trim(reg.first_name||' '||reg.last_name) ELSE tick.holder_name END,'productName',CASE WHEN ctype='registration' THEN reg.product_name ELSE tick.product_name END);
END $$;

ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.staff_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.access_zones ENABLE ROW LEVEL SECURITY; ALTER TABLE public.access_zones FORCE ROW LEVEL SECURITY;
ALTER TABLE public.occurrence_access_rules ENABLE ROW LEVEL SECURITY; ALTER TABLE public.occurrence_access_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.access_scan_attempts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.access_scan_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY; ALTER TABLE public.check_ins FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_permissions,public.access_zones,public.occurrence_access_rules,public.access_scan_attempts,public.check_ins FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.staff_permissions,public.access_zones,public.occurrence_access_rules,public.access_scan_attempts,public.check_ins TO service_role;
REVOKE ALL ON FUNCTION public.process_access_scan(text,text,uuid,uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_access_scan(text,text,uuid,uuid,uuid,text,boolean) TO service_role;
