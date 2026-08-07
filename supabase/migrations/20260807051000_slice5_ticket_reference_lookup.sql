-- Add staff-only ticket UUID lookup without weakening the opaque-token resolver.
ALTER FUNCTION public.process_access_scan(text,text,uuid,uuid,uuid,text,boolean) RENAME TO process_access_scan_core;

CREATE OR REPLACE FUNCTION public.process_access_scan(p_token_hash_hex text,p_reference text,p_occurrence_id uuid,p_zone_id uuid,p_scanner_user_id uuid,p_input_method text,p_guardian_present boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE resolved_hash text:=p_token_hash_hex;
BEGIN
  IF resolved_hash='' AND p_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    SELECT encode(token_hash,'hex') INTO resolved_hash FROM ticket_credentials WHERE ticket_id::text=lower(p_reference) AND status='active';
  END IF;
  RETURN public.process_access_scan_core(COALESCE(resolved_hash,''),p_reference,p_occurrence_id,p_zone_id,p_scanner_user_id,p_input_method,p_guardian_present);
END $$;
REVOKE ALL ON FUNCTION public.process_access_scan_core(text,text,uuid,uuid,uuid,text,boolean),public.process_access_scan(text,text,uuid,uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_access_scan_core(text,text,uuid,uuid,uuid,text,boolean),public.process_access_scan(text,text,uuid,uuid,uuid,text,boolean) TO service_role;
