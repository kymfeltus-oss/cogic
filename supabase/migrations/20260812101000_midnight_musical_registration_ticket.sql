-- The logical Midnight Musical event is explicitly cataloged as Friday. Add
-- its unpublished 2026 occurrence so the existing ticket domain can own the
-- registration-flow ticket without duplicating product infrastructure.
DO $$
DECLARE v_event uuid; v_occurrence uuid; v_entitlement uuid;
BEGIN
  SELECT id INTO v_event FROM public.events
  WHERE program_key='cogic-stream-2026' AND event_type='midnight_musical' LIMIT 1;
  IF v_event IS NULL THEN RAISE EXCEPTION 'Midnight Musical event catalog row is required'; END IF;
  SELECT id INTO v_occurrence FROM public.event_occurrences
  WHERE event_id=v_event AND local_date='2026-11-06' LIMIT 1;
  IF v_occurrence IS NULL THEN
    INSERT INTO public.event_occurrences(event_id,status,visibility,timezone,local_date,scheduled_start_at,venue_label,start_mode)
    VALUES(v_event,'scheduled','unpublished','America/Chicago','2026-11-06','2026-11-07T05:59:00Z',null,'fixed')
    RETURNING id INTO v_occurrence;
  END IF;
  INSERT INTO public.access_entitlements(program_key,entitlement_key,name,entitlement_type,event_occurrence_id,access_zone,single_use,usage_limit,active)
  VALUES('cogic-stream-2026','MIDNIGHT_MUSICAL_ENTRY_2026','Midnight Musical Entry','event_access',v_occurrence,'musical',true,1,true)
  ON CONFLICT(program_key,entitlement_key) DO UPDATE SET event_occurrence_id=excluded.event_occurrence_id,active=true
  RETURNING id INTO v_entitlement;
  INSERT INTO public.ticket_products(program_key,event_occurrence_id,entitlement_id,product_key,name,description,price_cents,currency,capacity,per_order_limit,active,public,refundable,sort_order)
  VALUES('cogic-stream-2026',v_occurrence,v_entitlement,'MIDNIGHT_MUSICAL_TICKET_2026','Musical Ticket','Admission to the Midnight Musical. Include yourself in the ticket count.',3000,'usd',10000,10,true,true,false,10)
  ON CONFLICT(program_key,product_key) DO UPDATE SET event_occurrence_id=excluded.event_occurrence_id,entitlement_id=excluded.entitlement_id,name=excluded.name,description=excluded.description,price_cents=3000,capacity=GREATEST(public.ticket_products.capacity,excluded.capacity),per_order_limit=10,active=true,public=true;
END $$;
