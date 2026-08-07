-- READ-ONLY production catalog evidence for wjlaaluonxiaxmytiqwi.
-- Run as one script in Supabase SQL Editor and export the complete result.
WITH migration_objects(version, object_name) AS (
  VALUES
  ('20260626120000','services'),('20260626120000','service_equipment'),('20260626120000','sound_items'),('20260626120000','mixers'),('20260626120000','microphones'),('20260626120000','cameras'),('20260626120000','internet_connections'),('20260626120000','streaming_destinations'),('20260626120000','recording_settings'),('20260626120000','presentation_sources'),('20260626120000','service_timeline_items'),('20260626120000','team_members'),('20260626120000','service_alerts'),('20260626120000','service_audit_log'),('20260626120000','stream_output_presets'),
  ('20260627120000','mixers'),('20260627120000','live_stream_state'),
  ('20260803010000','registration_credentials'),('20260803010000','credential_scan_events'),
  ('20260804120000','events'),
  ('20260806120000','replay_watch_progress'),('20260806120000','replay_favorites'),
  ('20260806130000','past_broadcast_recordings'),('20260806130100','past_broadcast_recordings'),
  ('20260806140000','convocation_archives'),('20260806140000','media_collections'),('20260806140000','media_collection_recordings'),('20260806140000','past_broadcast_recordings'),('20260806140000','donations'),
  ('20260806170000','production_crews'),('20260806170000','broadcast_sources'),('20260806170000','event_broadcast_assignments'),
  ('20260806180000','announcements'),('20260806180000','announcement_reads'),('20260806180000','past_broadcast_recordings'),('20260806180000','media-uploads'),
  ('20260806190000','push_subscriptions'),('20260806190000','push_preferences'),('20260806190000','push_delivery_log'),
  ('20260806200000','schedule_reminders'),
  ('20260806220000','registration_products'),('20260806220000','access_entitlements'),('20260806220000','registration_product_entitlements'),('20260806220000','attendee_entitlements'),
  ('20260806230000','registration_groups'),('20260806230000','registration_group_members'),('20260806230000','registration_policies'),('20260806230000','registration_policy_acceptances'),
  ('20260807010000','ticket_products'),('20260807010000','addon_products'),('20260807010000','commerce_orders'),('20260807010000','commerce_order_lines'),('20260807010000','ticket_instances'),('20260807010000','ticket_credentials'),('20260807010000','ticket_audit_log'),
  ('20260807030000','housing_hotels'),('20260807030000','housing_blocks'),('20260807030000','housing_requests'),('20260807030000','housing_request_registrants'),('20260807030000','housing_audit_log'),('20260807030000','housing_settings'),
  ('20260807050000','staff_permissions'),('20260807050000','access_zones'),('20260807050000','occurrence_access_rules'),('20260807050000','access_scan_attempts'),('20260807050000','check_ins'),
  ('20260807051000','process_access_scan')
), rels AS (
  SELECT mo.version, c.oid, n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity
  FROM migration_objects mo LEFT JOIN pg_catalog.pg_class c ON c.relname=mo.object_name
  LEFT JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace AND n.nspname IN ('public','storage')
  WHERE mo.object_name <> 'media-uploads'
), evidence AS (
  SELECT version,'relation'::text object_category,COALESCE(nspname,'public') schema_name,object_name,
    'relation exists with exact kind and RLS flags' expected_definition,
    COALESCE(format('kind=%s; rls=%s; force_rls=%s',relkind,relrowsecurity,relforcerowsecurity),'MISSING') production_definition
  FROM migration_objects mo LEFT JOIN rels r ON r.version=mo.version AND r.relname=mo.object_name WHERE mo.object_name <> 'media-uploads'
  UNION ALL
  SELECT r.version,'column',r.nspname,r.relname||'.'||a.attname,'column type/default/nullability',
    format('type=%s; not_null=%s; default=%s',pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,COALESCE(pg_get_expr(d.adbin,d.adrelid),'NULL'))
  FROM rels r JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=r.oid AND d.adnum=a.attnum
  UNION ALL
  SELECT r.version,'constraint',r.nspname,con.conname,'exact constraint definition',pg_get_constraintdef(con.oid,true)
  FROM rels r JOIN pg_catalog.pg_constraint con ON con.conrelid=r.oid
  UNION ALL
  SELECT r.version,'index',r.nspname,idx.relname,'exact index definition',pg_get_indexdef(i.indexrelid)
  FROM rels r JOIN pg_catalog.pg_index i ON i.indrelid=r.oid JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
  UNION ALL
  SELECT r.version,'trigger',r.nspname,t.tgname,'exact trigger definition',pg_get_triggerdef(t.oid,true)
  FROM rels r JOIN pg_catalog.pg_trigger t ON t.tgrelid=r.oid AND NOT t.tgisinternal
  UNION ALL
  SELECT r.version,'policy',r.nspname,p.polname,'command/roles/using/with-check',format('cmd=%s; roles=%s; using=%s; check=%s',p.polcmd,p.polroles,COALESCE(pg_get_expr(p.polqual,p.polrelid),'NULL'),COALESCE(pg_get_expr(p.polwithcheck,p.polrelid),'NULL'))
  FROM rels r JOIN pg_catalog.pg_policy p ON p.polrelid=r.oid
  UNION ALL
  SELECT DISTINCT r.version,'grant',r.nspname,r.relname,'table privileges',format('grantee=%s; privilege=%s',g.grantee,g.privilege_type)
  FROM rels r JOIN information_schema.role_table_grants g ON g.table_schema=r.nspname AND g.table_name=r.relname
), function_versions(version,function_name) AS (
  VALUES ('20260803010000','_credential_token_hash_from_hex'),('20260803010000','issue_registration_credential'),('20260803010000','activate_registration_credential'),('20260803010000','rotate_registration_credential'),('20260803010000','revoke_registration_credential'),('20260803010000','resolve_registration_credential'),('20260803010000','validate_registration_credential_status_transition'),('20260803010000','prevent_credential_scan_event_mutation'),('20260806190000','send_push_notification'),('20260806200000','claim_due_schedule_reminders'),('20260807010000','release_expired_ticket_reservations'),('20260807010000','cancel_ticket_reservation'),('20260807010000','reserve_commerce_order'),('20260807010000','fulfill_ticket_order'),('20260807010000','claim_free_addons'),('20260807010000','issue_complimentary_ticket'),('20260807010000','revoke_ticket'),('20260807030000','submit_housing_request'),('20260807030000','transition_housing_request'),('20260807050000','process_access_scan'),('20260807051000','process_access_scan_core'),('20260807051000','process_access_scan')
), function_evidence AS (
  SELECT fv.version,'function'::text object_category,'public'::text schema_name,fv.function_name,
    'signature, result, language, security, volatility, configuration, complete definition' expected_definition,
    COALESCE(string_agg(format('identity_args=%s; result=%s; language=%s; security_definer=%s; volatility=%s; config=%s; definition=%s',pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),l.lanname,p.prosecdef,p.provolatile,COALESCE(array_to_string(p.proconfig,','),'NULL'),pg_get_functiondef(p.oid)),E'\n---OVERLOAD---\n' ORDER BY pg_get_function_identity_arguments(p.oid)),'MISSING') production_definition
  FROM function_versions fv LEFT JOIN pg_catalog.pg_proc p ON p.proname=fv.function_name LEFT JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public' LEFT JOIN pg_catalog.pg_language l ON l.oid=p.prolang
  GROUP BY fv.version,fv.function_name
), enum_evidence AS (
  SELECT 'ALL'::text version,'enum'::text object_category,n.nspname schema_name,t.typname object_name,'exact enum values and ordering' expected_definition,string_agg(e.enumlabel,',' ORDER BY e.enumsortorder) production_definition
  FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' GROUP BY n.nspname,t.typname
), storage_evidence AS (
  SELECT '20260806180000'::text version,'storage_bucket'::text object_category,'storage'::text schema_name,'media-uploads'::text object_name,'public flag, size limit, MIME types',COALESCE((SELECT row_to_json(b)::text FROM storage.buckets b WHERE b.id='media-uploads'),'MISSING') production_definition
), backfill_evidence AS (
  SELECT '20260806130100'::text version,'backfill'::text object_category,'public'::text schema_name,'past_broadcast_recordings publication lifecycle'::text object_name,'linked completed recordings with playable URLs are published'::text expected_definition,format('violations=%s',(SELECT count(*) FROM public.past_broadcast_recordings r WHERE r.recording_url IS NOT NULL AND EXISTS (SELECT 1 FROM public.event_occurrences o WHERE o.replay_recording_id=r.id AND o.status='completed') AND r.publication_status<>'published')) production_definition
), ledger AS (
  SELECT 'LEDGER'::text version,'migration_ledger'::text object_category,'supabase_migrations'::text schema_name,version::text object_name,'current ledger row'::text expected_definition,row_to_json(m)::text production_definition FROM supabase_migrations.schema_migrations m
)
SELECT *,CASE WHEN production_definition='MISSING' THEN 'MISSING' ELSE 'REQUIRES_CODEX_COMPARISON' END verification_status FROM evidence
UNION ALL SELECT *,CASE WHEN production_definition='MISSING' THEN 'MISSING' ELSE 'REQUIRES_CODEX_COMPARISON' END FROM function_evidence
UNION ALL SELECT *,'REQUIRES_CODEX_COMPARISON' FROM enum_evidence
UNION ALL SELECT *,CASE WHEN production_definition='MISSING' THEN 'MISSING' ELSE 'REQUIRES_CODEX_COMPARISON' END FROM storage_evidence
UNION ALL SELECT *,'REQUIRES_CODEX_COMPARISON' FROM backfill_evidence
UNION ALL SELECT *,'SNAPSHOT' FROM ledger
ORDER BY version,object_category,schema_name,object_name;
