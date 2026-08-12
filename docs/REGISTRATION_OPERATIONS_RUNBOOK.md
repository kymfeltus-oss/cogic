# Registration Hub — Operations Runbook

**Brand:** COGIC LIVE  
**Program key:** `cogic-stream-2026`  
**Governing standard:** [`docs/IMPLEMENTATION_STANDARD.md`](./IMPLEMENTATION_STANDARD.md)

**Laws applied:** SERVER AUTHORITY · PAYMENTS (Stripe webhook authority) · BLOCKED ≠ FAKE · DEFINE THE ENVIRONMENT BOUNDARY · Law 24 (Do Not Declare Pass Too Early) · Law 25 (Definition of Done)

Never paste real secrets into tickets, chat, or this document.

---

## Core transaction management

The Registration Hub relies exclusively on **public server-side RPC execution functions** rather than row-by-row app-client loops. Multi-row status fragmentation is programmatically blocked at the database engine level (row locks, version snapshots, and atomic RPCs).

Authoritative transitions:

| RPC | Purpose |
|---|---|
| `save_registration_primary_draft` | Early identity draft without product |
| `submit_registration_group` | Draft → submitted (DB product pricing) |
| `begin_registration_checkout` | Submitted / payment_pending → pending Stripe Session |
| `cancel_pending_registration_checkout` | Retire stale pending Session before replacement |
| `fulfill_registration_checkout` | Stripe webhook payment authority → paid |
| `confirm_paid_registration_group` | Post-webhook group confirmation sync |
| `cancel_registration_group` | Atomic cancel of eligible group members |
| `correct_registration_attendee` | Allowlisted profile correction only |

**Payment authority:** Stripe webhook fulfillment marks payment paid and then confirms the group. Browser redirect to `/register/payment/complete` is **not** payment authority.

Illegal transitions (examples):

- Client-supplied `amount_cents` / `status` / `user_id` on draft or correction payloads
- `draft → confirmed` without submit + payment (or free-path submit RPC)
- Marking paid from checkout success URL alone
- Manual “mark paid” overrides in owner UI or SQL

---

## Automated queue executions

Background credential generation is driven by a cron endpoint runner (not invented credentials, not client loops):

| Item | Value |
|---|---|
| **Path** | `/api/cron/process-registration-credentials` |
| **Auth** | `Authorization: Bearer $CRON_SECRET` |
| **Schedule** | every 5 minutes (`*/5 * * * *` in `vercel.json`) |
| **Worker** | `lib/registration/process-credential-jobs.ts` |
| **Queue table** | `registration_credential_jobs` |

### Constraint engine

Handled via unique / due-task indexes on `registration_credential_jobs`:

- One open job per registration where `status IN ('pending', 'processing', 'retry', 'failed')`
- Due claim index on `next_attempt_at` where `status IN ('pending', 'retry', 'failed')`

Statuses are lowercase (`pending`, not `PENDING`).

### Worker loop

1. Claim due jobs via `claim_registration_credential_jobs`
2. Call real `issueRegistrationCredential` (no fake QR / fake issued state)
3. Complete job as `completed`, `retry`, or `dead`
4. Payment confirmation is **never** rolled back when issuance fails

### Manual cron invocation (operator)

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXT_PUBLIC_APP_URL/api/cron/process-registration-credentials"
```

Owner operators may also trigger a bounded queue drain from `/owner/registrations` via the authenticated `process_credential_queue` action (same worker; still requires service-role RPCs).

---

## Manual exception settlement

If a Stripe webhook drops connection or fails delivery, administrators reconcile from evidence — never from a client “mark paid” control.

### Truthful recovery path (available now)

1. Open the owner **Registration console** at `/owner/registrations` (group + member ledger view).
2. Identify the target registration / group (confirmation reference, email, or registration id).
3. In **Stripe Dashboard → Developers → Webhooks**, confirm whether `checkout.session.completed` (registration metadata) was delivered.
4. If the Checkout Session is **complete** and the webhook was missed: **Resend** the webhook event. The server path `fulfill_registration_checkout` → `confirm_paid_registration_group` updates local tables. There is **no** manual “mark paid” override.
5. If the Session is **expired / unused**: attendee uses **Resume secure payment** on `/register/review`. The server cancels the stale pending intent via `cancel_pending_registration_checkout` and creates a replacement Session from the verified total.
6. If credential issuance failed after confirm: inspect `registration_credential_jobs`, then retry via cron or owner `retry_credential` / `process_credential_queue`. Hub must show pending/blocked — never a fake QR.

### BLOCKED — OPERATOR ACTION REQUIRED (reconciliation UI)

A dedicated in-app “poll Stripe live by transaction id and sync ledger” reconciliation console is **not** shipped as a one-click override surface. Until that operator tool exists:

- Use Stripe webhook resend + server webhook handlers as the settlement engine
- Do **not** invent a SQL or UI “mark paid” path
- Escalate ledger disagreements that remain after webhook evidence is applied

---

## 1. Environment boundary

| Variable | Production requirement |
|---|---|
| `USE_MOCK_REGISTRATION` | Must be `false` or **unset** |
| `VERCEL_ENV` | `production` on the live host |
| `LIVE_ACCESS_DEV_BYPASS` | unset / false |
| `OPS_ADMIN_DEV_BYPASS` | unset / false |
| `ATTENDEE_AUTH_OPEN` | unset / false |

`lib/registration/runtime-mode.ts` resolves the boundary. If `USE_MOCK_REGISTRATION=true` inside the production / Vercel production boundary:

- `/api/health` → `status: "not_ready"`, `mockRegistrationDisabled: false`, blocked reason set
- `getSystemReadinessStatus()` → `UNHEALTHY`
- `assertSafeRegistrationEnvironment()` throws on registration experience / credential cron entrypoints

Sandbox interceptors are never production PASS. Code completeness alone is not production PASS (Law 24).

---

## 2. Refund operations ledger

Migration: `supabase/migrations/20260812040000_registration_admin_operations.sql`

Table: `registration_refund_operations`

Tracks:

- Unique `operation_key` and `idempotency_key`
- `requested_amount_cents` + `currency`
- Stripe identifiers (`stripe_refund_id`, `stripe_payment_intent_id`, `stripe_charge_id`)
- Operator `operator_user_id` + audit `operator_reason` (≥ 8 chars)
- Status: `requested` → `submitted_to_stripe` → `succeeded` | `failed` | `canceled`

Owner refund saga (Phase 3):

1. `POST /api/owner/registrations/refund` with `registrationId` + reason (no client amount)
2. RPC `claim_registration_refund_operation` locks the paid payment and stamps `requested_amount_cents` from the ledger
3. Server Stripe `refunds.create` with explicit idempotency key and DB amount
4. RPC `complete_registration_refund_operation` marks payment/registration `refunded`

**BLOCKED — OPERATOR ACTION REQUIRED** until migrations `20260812040000` and `20260812050000` are applied on the target Supabase project.

Do not invent refund success in attendee UI without ledger evidence.

---

## 3. Attendee profile corrections

RPC: `correct_registration_attendee(p_actor_user_id, p_registration_id, p_corrections, p_expected_registration_version, p_audit_reason)`

Allowlisted correction keys only:

- `firstName`
- `lastName`
- `email`
- `phone` → `mobile_phone`
- `interpretationLanguage` → `preferred_language` (+ `requires_interpretation`)
- `juniorDob` → `date_of_birth`

Rejected (always): price, status, currency, Stripe ids, ownership, product, group, row_version, and any non-allowlisted key.

Execution requires:

1. Service-role server caller (RPC is not granted to `anon` / `authenticated`)
2. Row lock (`FOR UPDATE`) + optional expected `row_version`
3. Audit reason (≥ 8 characters) written via `_registration_audit`

---

## 4. Credential job `dead` recovery

1. Inspect `registration_credential_jobs.last_error` / `terminal_reason`.
2. Confirm registration `status = confirmed`.
3. Fix root cause (schema, secret, RPC error).
4. Re-enqueue via `enqueue_registration_credential_job` (service role) or owner `retry_credential`.
5. Hub must show credential pending / blocked — never a fake QR.

---

## 5. Required migrations (Registration Hub)

Apply in order on the target project:

1. `20260812010000_registration_draft_resume.sql`
2. `20260812020000_registration_atomic_lifecycle.sql`
3. `20260812030000_registration_credential_retry_queue.sql`
4. `20260812040000_registration_admin_operations.sql`
5. `20260812050000_registration_refund_claim.sql`

Until applied: **BLOCKED — OPERATOR ACTION REQUIRED**.

---

## 6. Verification gates (Law 25)

Before declaring production PASS:

1. `npm run test:registration`
2. `npm run build`
3. `GET /api/health` → `ready` with `mockRegistrationDisabled: true`
4. Operator smoke checklist in `.env.example` (bottom section) completed on the live project
5. Stripe LIVE webhook delivering `checkout.session.completed` for registration
6. Credential cron authorized and processing real queue rows (`pending` / `retry` / `failed` claims)

Incomplete smoke = not done. Do not declare PASS early (Law 24).

---

## Phase 4 authoritative plumbing update

This section supersedes earlier blocked reconciliation and refund-completion notes.

- `registration-requirements.ts` is the single evaluator for completed requirements, blockers, percentage, allowed destinations, and server-derived `resumeStep`.
- `save_registration_primary_draft` persists Step 1 before product selection.
- Group submission, confirmation, cancellation, offline-check reconciliation, and refund completion use locked transactional RPCs.
- Successful refunds verify the captured Stripe PaymentIntent, use the ledger amount, transition the entire group to `refunded`, and revoke active credentials.
- Owner reconciliation supports Stripe verification, idempotent webhook replay, and audited offline-check recording. There is no manual “mark paid” bypass.
- Required migrations run through `20260812060000_registration_phase3_reconciliation.sql`.

### Sandbox interceptors

`USE_MOCK_REGISTRATION=true` intercepts outbound registration checkout and credential presentation only when `registrationDemoModeAllowed()` resolves a Preview/Development boundary. Responses carry `sandbox: true`; sandbox credentials also carry `persisted: false`. Production always disables interception, and readiness remains `not_ready` while the flag is enabled anywhere.

### Stripe event routing and tracking

Registration Checkout fulfillment uses signed `checkout.session.completed` and `checkout.session.async_payment_succeeded` events with `metadata.checkout_type=registration`, `registration_id`, `program_key`, `user_id`, `email`, and `amount_cents`. Track Stripe Session and PaymentIntent identifiers in `registration_payments`. `payment_intent.succeeded` remains active for travel PaymentIntent fulfillment and is not registration redirect authority.

### Active HTTP 410 retirement routes

Registration exposes no retired manual-confirm endpoint; unsupported actions return 400. Active 410 surfaces are the travel manual-confirm/recheck and attendee-typed reservation mutations documented in `docs/TRAVEL_LIVE_PLUMBING.md`; they must not be reused as registration bypasses.
