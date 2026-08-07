-- Registration Slice 3: event tickets, add-ons, reservations, fulfillment, and audit.
-- Target project: wjlaaluonxiaxmytiqwi. No products, prices, occurrences, or demo orders are seeded.

CREATE TABLE public.ticket_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_key text NOT NULL DEFAULT 'cogic-stream-2026',
  event_occurrence_id uuid NOT NULL REFERENCES public.event_occurrences(id) ON DELETE RESTRICT,
  entitlement_id uuid NOT NULL REFERENCES public.access_entitlements(id) ON DELETE RESTRICT,
  product_key text NOT NULL, name text NOT NULL, description text NULL, price_cents integer NOT NULL CHECK(price_cents>=0), currency text NOT NULL DEFAULT 'usd',
  capacity integer NOT NULL CHECK(capacity>=0), sale_start timestamptz NULL, sale_end timestamptz NULL, per_order_limit integer NOT NULL DEFAULT 10 CHECK(per_order_limit>0),
  active boolean NOT NULL DEFAULT false, public boolean NOT NULL DEFAULT false, refundable boolean NOT NULL DEFAULT false, policy_reference text NULL, sort_order integer NOT NULL DEFAULT 0,
  sold_count integer NOT NULL DEFAULT 0 CHECK(sold_count>=0), reserved_count integer NOT NULL DEFAULT 0 CHECK(reserved_count>=0),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL, updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_key,product_key), CHECK(sold_count+reserved_count<=capacity), CHECK(sale_end IS NULL OR sale_start IS NULL OR sale_end>sale_start)
);
CREATE TABLE public.addon_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_key text NOT NULL DEFAULT 'cogic-stream-2026', addon_key text NOT NULL,
  name text NOT NULL, description text NULL, price_cents integer NOT NULL CHECK(price_cents>=0), currency text NOT NULL DEFAULT 'usd', included boolean NOT NULL DEFAULT false,
  max_quantity integer NOT NULL DEFAULT 10 CHECK(max_quantity>0), active boolean NOT NULL DEFAULT false, public boolean NOT NULL DEFAULT false,
  available_from timestamptz NULL, available_until timestamptz NULL, fulfillment_type text NOT NULL CHECK(fulfillment_type IN('physical','content')),
  entitlement_id uuid NULL REFERENCES public.access_entitlements(id) ON DELETE RESTRICT,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL, updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(program_key,addon_key),
  CHECK(available_until IS NULL OR available_from IS NULL OR available_until>available_from), CHECK(fulfillment_type<>'content' OR entitlement_id IS NOT NULL)
);
CREATE TABLE public.commerce_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_key text NOT NULL DEFAULT 'cogic-stream-2026', purchaser_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  registration_group_id uuid NULL REFERENCES public.registration_groups(id) ON DELETE SET NULL, checkout_type text NOT NULL CHECK(checkout_type IN('ticket_purchase','complimentary')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','checkout_created','paid','failed','canceled','expired','complimentary')),
  fulfillment_status text NOT NULL DEFAULT 'pending' CHECK(fulfillment_status IN('pending','fulfilled','failed','revoked')),
  amount_cents integer NOT NULL CHECK(amount_cents>=0), currency text NOT NULL DEFAULT 'usd', processing_fee_cents integer NOT NULL DEFAULT 0 CHECK(processing_fee_cents>=0),
  stripe_session_id text NULL UNIQUE, stripe_payment_intent_id text NULL, reservation_expires_at timestamptz NULL,
  paid_at timestamptz NULL, fulfilled_at timestamptz NULL, created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.commerce_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.commerce_orders(id) ON DELETE CASCADE,
  line_type text NOT NULL CHECK(line_type IN('ticket','addon')), ticket_product_id uuid NULL REFERENCES public.ticket_products(id) ON DELETE RESTRICT,
  addon_product_id uuid NULL REFERENCES public.addon_products(id) ON DELETE RESTRICT, name_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK(quantity>0), unit_amount_cents integer NOT NULL CHECK(unit_amount_cents>=0), total_amount_cents integer NOT NULL CHECK(total_amount_cents>=0),
  fulfillment_status text NOT NULL DEFAULT 'pending' CHECK(fulfillment_status IN('pending','ready','distributed','fulfilled','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(), CHECK((line_type='ticket' AND ticket_product_id IS NOT NULL AND addon_product_id IS NULL) OR (line_type='addon' AND addon_product_id IS NOT NULL AND ticket_product_id IS NULL))
);
CREATE TABLE public.ticket_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_line_id uuid NOT NULL REFERENCES public.commerce_order_lines(id) ON DELETE RESTRICT,
  ticket_product_id uuid NOT NULL REFERENCES public.ticket_products(id) ON DELETE RESTRICT, purchaser_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL, holder_name text NULL, sequence_number integer NOT NULL,
  status text NOT NULL CHECK(status IN('pending','valid','used','revoked','refunded','expired')), complimentary boolean NOT NULL DEFAULT false,
  issued_at timestamptz NULL, used_at timestamptz NULL, revoked_at timestamptz NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_line_id,sequence_number)
);
CREATE TABLE public.ticket_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid NOT NULL UNIQUE REFERENCES public.ticket_instances(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE, status text NOT NULL CHECK(status IN('active','rotated','revoked','expired')), issued_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz NULL
);
CREATE TABLE public.ticket_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, order_id uuid NULL REFERENCES public.commerce_orders(id) ON DELETE SET NULL,
  ticket_id uuid NULL REFERENCES public.ticket_instances(id) ON DELETE SET NULL, actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_products_occurrence_idx ON public.ticket_products(event_occurrence_id,active,public);
CREATE INDEX commerce_orders_user_idx ON public.commerce_orders(purchaser_user_id,created_at DESC);
CREATE INDEX ticket_instances_user_idx ON public.ticket_instances(purchaser_user_id,assigned_user_id,status);
CREATE INDEX ticket_audit_order_idx ON public.ticket_audit_log(order_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.release_expired_ticket_reservations() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer:=0; r record;
BEGIN
 FOR r IN SELECT o.id,l.ticket_product_id,l.quantity FROM commerce_orders o JOIN commerce_order_lines l ON l.order_id=o.id AND l.line_type='ticket' WHERE o.status IN('pending','checkout_created') AND o.reservation_expires_at<=now() FOR UPDATE OF o LOOP
  UPDATE ticket_products SET reserved_count=reserved_count-r.quantity WHERE id=r.ticket_product_id;
  UPDATE commerce_orders SET status='expired',updated_at=now() WHERE id=r.id;
  INSERT INTO ticket_audit_log(order_id,action) VALUES(r.id,'reservation_expired'); n:=n+1;
 END LOOP; RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.cancel_ticket_reservation(p_order_id uuid,p_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM commerce_orders WHERE id=p_order_id AND purchaser_user_id=p_user_id AND status IN('pending','checkout_created') FOR UPDATE) THEN RETURN false; END IF;
 FOR r IN SELECT ticket_product_id,quantity FROM commerce_order_lines WHERE order_id=p_order_id AND line_type='ticket' LOOP UPDATE ticket_products SET reserved_count=reserved_count-r.quantity WHERE id=r.ticket_product_id; END LOOP;
 UPDATE commerce_orders SET status='canceled',updated_at=now() WHERE id=p_order_id; INSERT INTO ticket_audit_log(order_id,actor_user_id,action) VALUES(p_order_id,p_user_id,'reservation_canceled'); RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_commerce_order(p_user_id uuid,p_program_key text,p_lines jsonb,p_registration_group_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE oid uuid:=gen_random_uuid(); item jsonb; tp ticket_products%ROWTYPE; ap addon_products%ROWTYPE; qty integer; total integer:=0; nowv timestamptz:=now();
BEGIN
 PERFORM release_expired_ticket_reservations();
 IF jsonb_array_length(p_lines)=0 THEN RAISE EXCEPTION 'At least one line is required'; END IF;
 INSERT INTO commerce_orders(id,program_key,purchaser_user_id,registration_group_id,checkout_type,status,amount_cents,reservation_expires_at,created_by) VALUES(oid,p_program_key,p_user_id,p_registration_group_id,'ticket_purchase','pending',0,nowv+interval '30 minutes',p_user_id);
 FOR item IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
  qty:=COALESCE((item->>'quantity')::integer,0); IF qty<=0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  IF item->>'type'='ticket' THEN
   SELECT * INTO tp FROM ticket_products WHERE id=(item->>'productId')::uuid AND program_key=p_program_key FOR UPDATE;
   IF NOT FOUND OR NOT tp.active OR NOT tp.public THEN RAISE EXCEPTION 'Ticket product unavailable'; END IF;
   IF (tp.sale_start IS NOT NULL AND nowv<tp.sale_start) OR (tp.sale_end IS NOT NULL AND nowv>=tp.sale_end) THEN RAISE EXCEPTION 'Ticket sale is closed'; END IF;
   IF qty>tp.per_order_limit THEN RAISE EXCEPTION 'Ticket quantity exceeds per-order limit'; END IF;
   IF tp.sold_count+tp.reserved_count+qty>tp.capacity THEN RAISE EXCEPTION 'Ticket product sold out'; END IF;
   UPDATE ticket_products SET reserved_count=reserved_count+qty WHERE id=tp.id;
   INSERT INTO commerce_order_lines(order_id,line_type,ticket_product_id,name_snapshot,quantity,unit_amount_cents,total_amount_cents) VALUES(oid,'ticket',tp.id,tp.name,qty,tp.price_cents,tp.price_cents*qty);
   total:=total+tp.price_cents*qty;
  ELSIF item->>'type'='addon' THEN
   SELECT * INTO ap FROM addon_products WHERE id=(item->>'productId')::uuid AND program_key=p_program_key;
   IF NOT FOUND OR NOT ap.active OR NOT ap.public THEN RAISE EXCEPTION 'Add-on unavailable'; END IF;
   IF (ap.available_from IS NOT NULL AND nowv<ap.available_from) OR (ap.available_until IS NOT NULL AND nowv>=ap.available_until) OR qty>ap.max_quantity THEN RAISE EXCEPTION 'Add-on unavailable'; END IF;
   INSERT INTO commerce_order_lines(order_id,line_type,addon_product_id,name_snapshot,quantity,unit_amount_cents,total_amount_cents) VALUES(oid,'addon',ap.id,ap.name,qty,ap.price_cents,ap.price_cents*qty);
   total:=total+ap.price_cents*qty;
  ELSE RAISE EXCEPTION 'Invalid line type'; END IF;
 END LOOP;
 UPDATE commerce_orders SET amount_cents=total WHERE id=oid;
 INSERT INTO ticket_audit_log(order_id,actor_user_id,action,details) VALUES(oid,p_user_id,'order_reserved',jsonb_build_object('amount_cents',total));
 RETURN jsonb_build_object('order_id',oid,'amount_cents',total,'reservation_expires_at',nowv+interval '30 minutes');
END $$;

CREATE OR REPLACE FUNCTION public.fulfill_ticket_order(p_stripe_session_id text,p_payment_intent_id text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o commerce_orders%ROWTYPE; l record; i integer; tid uuid; ent uuid;
BEGIN
 SELECT * INTO o FROM commerce_orders WHERE stripe_session_id=p_stripe_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ticket order not found'; END IF;
 IF o.status IN('paid','complimentary') AND o.fulfillment_status='fulfilled' THEN RETURN jsonb_build_object('idempotent',true,'order_id',o.id); END IF;
 IF o.status NOT IN('pending','checkout_created') OR o.reservation_expires_at<=now() THEN RAISE EXCEPTION 'Ticket reservation is not fulfillable'; END IF;
 FOR l IN SELECT * FROM commerce_order_lines WHERE order_id=o.id FOR UPDATE LOOP
  IF l.line_type='ticket' THEN
   UPDATE ticket_products SET reserved_count=reserved_count-l.quantity,sold_count=sold_count+l.quantity WHERE id=l.ticket_product_id;
   SELECT entitlement_id INTO ent FROM ticket_products WHERE id=l.ticket_product_id;
   FOR i IN 1..l.quantity LOOP
    INSERT INTO ticket_instances(order_line_id,ticket_product_id,purchaser_user_id,assigned_user_id,sequence_number,status,complimentary,issued_at) VALUES(l.id,l.ticket_product_id,o.purchaser_user_id,CASE WHEN i=1 THEN o.purchaser_user_id ELSE NULL END,i,'valid',false,now()) RETURNING id INTO tid;
    IF i=1 THEN INSERT INTO attendee_entitlements(program_key,user_id,entitlement_id,status,quantity,uses_consumed) VALUES(o.program_key,o.purchaser_user_id,ent,'active',1,0); END IF;
   END LOOP;
   UPDATE commerce_order_lines SET fulfillment_status='fulfilled' WHERE id=l.id;
  ELSE
   UPDATE commerce_order_lines SET fulfillment_status=CASE WHEN l.unit_amount_cents=0 THEN 'fulfilled' WHEN EXISTS(SELECT 1 FROM addon_products a WHERE a.id=l.addon_product_id AND a.fulfillment_type='content') THEN 'fulfilled' ELSE 'pending' END WHERE id=l.id;
   INSERT INTO attendee_entitlements(program_key,user_id,entitlement_id,status,quantity,uses_consumed) SELECT o.program_key,o.purchaser_user_id,a.entitlement_id,'active',l.quantity,0 FROM addon_products a WHERE a.id=l.addon_product_id AND a.fulfillment_type='content' ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 UPDATE commerce_orders SET status='paid',fulfillment_status='fulfilled',stripe_payment_intent_id=p_payment_intent_id,paid_at=now(),fulfilled_at=now(),updated_at=now() WHERE id=o.id;
 INSERT INTO ticket_audit_log(order_id,action) VALUES(o.id,'stripe_fulfilled'); RETURN jsonb_build_object('idempotent',false,'order_id',o.id);
END $$;

CREATE OR REPLACE FUNCTION public.claim_free_addons(p_user_id uuid,p_program_key text,p_lines jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE oid uuid:=gen_random_uuid(); item jsonb; ap addon_products%ROWTYPE; qty integer; lid uuid;
BEGIN
 INSERT INTO commerce_orders(id,program_key,purchaser_user_id,checkout_type,status,fulfillment_status,amount_cents,fulfilled_at,created_by) VALUES(oid,p_program_key,p_user_id,'complimentary','complimentary','fulfilled',0,now(),p_user_id);
 FOR item IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
  qty:=COALESCE((item->>'quantity')::integer,0); SELECT * INTO ap FROM addon_products WHERE id=(item->>'productId')::uuid AND program_key=p_program_key AND active AND public AND price_cents=0 AND fulfillment_type='content';
  IF NOT FOUND OR qty<=0 OR qty>ap.max_quantity THEN RAISE EXCEPTION 'Free content add-on unavailable'; END IF;
  INSERT INTO commerce_order_lines(order_id,line_type,addon_product_id,name_snapshot,quantity,unit_amount_cents,total_amount_cents,fulfillment_status) VALUES(oid,'addon',ap.id,ap.name,qty,0,0,'fulfilled') RETURNING id INTO lid;
  INSERT INTO attendee_entitlements(program_key,user_id,entitlement_id,status,quantity,uses_consumed) VALUES(p_program_key,p_user_id,ap.entitlement_id,'active',qty,0) ON CONFLICT DO NOTHING;
 END LOOP;
 INSERT INTO ticket_audit_log(order_id,actor_user_id,action) VALUES(oid,p_user_id,'free_content_claimed'); RETURN jsonb_build_object('order_id',oid);
END $$;

CREATE OR REPLACE FUNCTION public.issue_complimentary_ticket(p_product_id uuid,p_user_id uuid,p_actor_user_id uuid,p_holder_name text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tp ticket_products%ROWTYPE; oid uuid:=gen_random_uuid(); lid uuid; tid uuid;
BEGIN
 SELECT * INTO tp FROM ticket_products WHERE id=p_product_id FOR UPDATE; IF NOT FOUND OR NOT tp.active OR tp.sold_count+tp.reserved_count>=tp.capacity THEN RAISE EXCEPTION 'Ticket unavailable'; END IF;
 UPDATE ticket_products SET sold_count=sold_count+1 WHERE id=tp.id;
 INSERT INTO commerce_orders(id,program_key,purchaser_user_id,checkout_type,status,fulfillment_status,amount_cents,fulfilled_at,created_by) VALUES(oid,tp.program_key,p_user_id,'complimentary','complimentary','fulfilled',0,now(),p_actor_user_id);
 INSERT INTO commerce_order_lines(order_id,line_type,ticket_product_id,name_snapshot,quantity,unit_amount_cents,total_amount_cents,fulfillment_status) VALUES(oid,'ticket',tp.id,tp.name,1,0,0,'fulfilled') RETURNING id INTO lid;
 INSERT INTO ticket_instances(order_line_id,ticket_product_id,purchaser_user_id,assigned_user_id,holder_name,sequence_number,status,complimentary,issued_at) VALUES(lid,tp.id,p_user_id,p_user_id,p_holder_name,1,'valid',true,now()) RETURNING id INTO tid;
 INSERT INTO attendee_entitlements(program_key,user_id,entitlement_id,status,quantity,uses_consumed) VALUES(tp.program_key,p_user_id,tp.entitlement_id,'active',1,0) ON CONFLICT DO NOTHING;
 INSERT INTO ticket_audit_log(order_id,ticket_id,actor_user_id,action) VALUES(oid,tid,p_actor_user_id,'complimentary_issued'); RETURN tid;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_ticket(p_ticket_id uuid,p_actor_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t ticket_instances%ROWTYPE;
BEGIN
 SELECT * INTO t FROM ticket_instances WHERE id=p_ticket_id FOR UPDATE; IF NOT FOUND OR t.status NOT IN('valid','pending') THEN RETURN false; END IF;
 UPDATE ticket_instances SET status='revoked',revoked_at=now(),updated_at=now() WHERE id=t.id; UPDATE ticket_credentials SET status='revoked',revoked_at=now() WHERE ticket_id=t.id AND status='active';
 INSERT INTO ticket_audit_log(ticket_id,actor_user_id,action) VALUES(t.id,p_actor_user_id,'ticket_revoked'); RETURN true;
END $$;

ALTER TABLE public.ticket_products ENABLE ROW LEVEL SECURITY; ALTER TABLE public.ticket_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.addon_products ENABLE ROW LEVEL SECURITY; ALTER TABLE public.addon_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_orders ENABLE ROW LEVEL SECURITY; ALTER TABLE public.commerce_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_order_lines ENABLE ROW LEVEL SECURITY; ALTER TABLE public.commerce_order_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_instances ENABLE ROW LEVEL SECURITY; ALTER TABLE public.ticket_instances FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_credentials ENABLE ROW LEVEL SECURITY; ALTER TABLE public.ticket_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_audit_log ENABLE ROW LEVEL SECURITY; ALTER TABLE public.ticket_audit_log FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.ticket_products,public.addon_products,public.commerce_orders,public.commerce_order_lines,public.ticket_instances,public.ticket_credentials,public.ticket_audit_log FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ticket_products,public.addon_products,public.commerce_orders,public.commerce_order_lines,public.ticket_instances,public.ticket_credentials,public.ticket_audit_log TO service_role;
REVOKE ALL ON FUNCTION public.reserve_commerce_order(uuid,text,jsonb,uuid),public.release_expired_ticket_reservations(),public.cancel_ticket_reservation(uuid,uuid),public.fulfill_ticket_order(text,text),public.claim_free_addons(uuid,text,jsonb),public.issue_complimentary_ticket(uuid,uuid,uuid,text),public.revoke_ticket(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_commerce_order(uuid,text,jsonb,uuid),public.release_expired_ticket_reservations(),public.cancel_ticket_reservation(uuid,uuid),public.fulfill_ticket_order(text,text),public.claim_free_addons(uuid,text,jsonb),public.issue_complimentary_ticket(uuid,uuid,uuid,text),public.revoke_ticket(uuid,uuid) TO service_role;
