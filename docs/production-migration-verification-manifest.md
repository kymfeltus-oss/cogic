# Production migration verification manifest

Generated from the complete local SQL for the 18 historical ledger gaps. Definitions must be compared with the normalized output from `scripts/verify-production-migration-state.sql`; object-name existence alone is insufficient.

## 20260626120000

Files: `attendee_playback_hls_url.sql`, `todays_service.sql`.

- Tables: `services`, `service_equipment`, `sound_items`, `mixers`, `microphones`, `cameras`, `internet_connections`, `streaming_destinations`, `recording_settings`, `presentation_sources`, `service_timeline_items`, `team_members`, `service_alerts`, `service_audit_log`.
- Columns: every table definition, plus `services.attendee_playback_hls_url` and `stream_output_presets.attendee_playback_hls_url`.
- Constraints/indexes: declared PK/FK/check/default/nullability definitions and the 14 service-scoped indexes.
- RLS/grants: RLS and FORCE RLS on all new tables; no public/anon/authenticated privileges; service-role full access.
- Functions/triggers/enums/backfill: none.
- Verification: relation flags, every column/default, constraint, index and grant row for the listed relations.

## 20260627120000

Files: `mixer_setup_json.sql`, `owner_broadcast_state.sql`.

- Columns: `mixers.imported_setup_json`, `mixers.connection_config_json`; `live_stream_state.publish_mode`, `publish_status`, `playback_status`, two error fields, `publisher_session_id`, `publisher_channel`.
- Constraints/indexes: JSON defaults/not-null; three broadcast-state checks; `mixers_tenant_last_connected_idx` definition.
- Other categories: no tables/functions/triggers/policies/enums/backfill.
- Verification: exact column and check/index definitions on `mixers` and `live_stream_state`.

## 20260803010000

- Tables: `registration_credentials`, `credential_scan_events` with all PK/FK/check/unique/default/nullability definitions.
- Indexes: usable-token partial unique index plus registration/status and scan lookup indexes.
- Functions/RPCs: `_credential_token_hash_from_hex`, issuance, activation, rotation, revocation, resolution, status-transition validation, immutable-scan validation. Compare identity arguments, results, language, SECURITY DEFINER, volatility, `search_path`, and full bodies.
- Triggers: updated-at, credential transition, and scan UPDATE/DELETE prevention.
- RLS/grants: enabled and forced on both tables; service-role-only tables/RPC execution.
- Data expectations: none beyond RPC behavior.

## 20260804120000

- Table change: replacement `events_event_type_check` including `general_assembly` with the complete allowed-value set.
- Data: one idempotent `cogic-stream-2026/general-assembly` draft catalog row with its authoritative title/type/description.
- Verification: exact check definition and a read-only row check. No functions/indexes/RLS changes.

## 20260806120000

- Tables: `replay_watch_progress`, `replay_favorites`; composite keys/FKs/checks/defaults.
- Index/trigger: `replay_watch_progress_user_updated_idx`, updated-at trigger.
- RLS/policies: enabled and forced; owner policies for authenticated per-user SELECT/INSERT/UPDATE/DELETE semantics.
- Grants: authenticated CRUD and service-role full access.

## 20260806130000

- Columns on `past_broadcast_recordings`: description, thumbnail, numeric duration, publication status/default, published/archived timestamps, updater FK.
- Constraints/index: exact lifecycle-value check, positive-duration check, publication-status/published-at index.
- No data mutation or new RLS.

## 20260806130100

- Backfill: completed occurrence-linked recordings with playable URLs become `published`, with publication time populated.
- Verification: read-only violation count in the SQL package. A nonzero count means missing; a zero count must still be reviewed for vacuous/no-row ambiguity.

## 20260806140000

- Tables: `convocation_archives`, `media_collections`, `media_collection_recordings` with full keys, checks and FKs.
- Columns: recording archive FK; donation user/fund/source/program/media/event/occurrence/collection/JSON attribution fields.
- Constraints/indexes: donation source-type check and archive/collection/recording/donation indexes.
- RLS/policies/grants: RLS+FORCE on archive tables; published-only nested public policies; anon/authenticated SELECT; service-role full access.
- Triggers: archive and collection updated-at.

## 20260806170000

- Tables: `production_crews`, `broadcast_sources`, `event_broadcast_assignments` with controlled source/provider/status checks, FKs and uniqueness.
- Indexes: crew/active lookup and primary assignment partial index.
- Triggers: updated-at on all three.
- RLS/grants: RLS enabled; service-role-only access. Verify whether FORCE RLS is intentionally absent exactly as SQL states.

## 20260806180000

- Tables: `announcements`, `announcement_reads`; lifecycle/audience/category checks, keys, timestamps and occurrence FK.
- Recording columns: source type, storage bucket/path, technical upload status.
- Indexes: status, pinned partial, and reads-by-user.
- RLS/policies/grants: published announcement read and own-read policies with exact expressions/roles/commands; documented grants.
- Storage: `media-uploads` bucket public flag, 500 MiB limit, three MIME types; public-read and service-role-all object policies.

## 20260806190000

- Tables: `push_subscriptions`, `push_preferences`, `push_delivery_log` with endpoint/user uniqueness, status/type checks, FKs/defaults.
- Functions: push claim/delivery functions present in the file; compare all signatures, bodies, security and `search_path`.
- Indexes/triggers: subscription/preference/delivery indexes and updated-at triggers declared by SQL.
- RLS/policies/grants: exact owner policies and service-role boundaries.

## 20260806200000

- Table: `schedule_reminders` with user/occurrence FK, offset/status/channel checks, uniqueness and timestamps.
- Function: due-reminder claim RPC, full signature/body/security/search path.
- Indexes/RLS/policies/grants: due lookup, user ownership operations, service-role processing privileges.

## 20260806220000

- Tables: `registration_products`, `access_entitlements`, product-entitlement join, `attendee_entitlements`.
- Columns/constraints: controlled entitlement types, product lifecycle/pricing/capacity, event scopes, validity/usage/guardian fields, uniqueness and FKs.
- Functions/triggers/indexes: all provisioning/checkout-support routines, updated-at/provisioning triggers and declared lookup indexes.
- RLS/policies/grants: public-active catalog reads where declared; attendee-owned entitlement reads; service-role mutation/RPC boundaries.

## 20260806230000

- Tables: registration groups/members, versioned policies, policy acceptances.
- Existing registration changes: group/product/policy linkage fields and associated FKs/checks.
- Functions/RPCs: group, policy publication/acceptance and registration lifecycle routines defined by the file; verify complete definitions and grants.
- Indexes/triggers/RLS/policies: every declared definition, FORCE flags and service-role/attendee boundaries.

## 20260807010000

- Tables: ticket/add-on products, commerce orders/lines, ticket instances/credentials/audit.
- Constraints/indexes: all price/capacity/status/fulfillment/line-type checks, occurrence/entitlement FKs, token uniqueness and inventory/audit indexes.
- RPCs: reservation release/cancel/create, Stripe fulfillment, free add-on claim, complimentary issue, ticket revoke. Verify full bodies, locks, SECURITY DEFINER and `search_path`.
- RLS/grants: RLS+FORCE and service-role-only mutation/RPC execution.

## 20260807030000

- Tables: hotels, blocks, housing requests/registrants/audit/settings.
- Constraints/indexes: request-only versus inventory invariants, dates/nights/occupancy/status/deposit checks, active-room partial unique index and operational indexes.
- RPCs: `submit_housing_request`, `transition_housing_request`, including complete bodies/security/search path.
- RLS/grants: enabled+forced and service-role-only access/RPC execution.

## 20260807050000

- Tables: staff permissions, zones, occurrence rules, scan attempts, check-ins.
- Constraints/indexes: role/zone/access/usage/decision/reason checks, FKs, unique check-ins and recent/occurrence indexes.
- RPC: original `process_access_scan` implementation; full signature/body/security/search path.
- RLS/grants: enabled+forced on every table; service-role-only table and RPC access.

## 20260807051000

- Functions: renames the prior implementation to `process_access_scan_core` and installs a same-signature wrapper supporting ticket UUID lookup before delegating.
- Grants: both functions service-role-only.
- Verification: both exact definitions, identity arguments, result types, SECURITY DEFINER state, configuration, and privileges. No tables/indexes/RLS/data mutation.

## Evidence decision rule

Classify a migration **A** only if every applicable manifest category matches exported production definitions and any backfill query is conclusive. Any missing object is **B**. Any incomplete, vacuous, or non-comparable evidence is **C**.
