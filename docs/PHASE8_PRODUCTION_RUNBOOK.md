# Phase 8 — Production Deployment & Launch Hardening Runbook

**Brand:** COGIC LIVE  
**Program key:** `cogic-stream-2026`  
**Authoritative Supabase:** `wjlaaluonxiaxmytiqwi`  
**Stripe mode:** LIVE (intentional — no demo/fake payment mode)

Never paste real secrets into tickets, chat, or this document.

---

## 1. Link the correct Vercel project

1. Confirm the target Vercel project is the **COGIC LIVE** app (not unrelated projects such as `dexcole220`).
2. From the repo root:

```bash
npx vercel link
```

3. Select the correct team + project, or stop if uncertain:

**VERCEL PROJECT SELECTION REQUIRED**

Do not deploy COGIC LIVE into an unrelated project merely because it is available.

---

## 2. Production environment parity

In Vercel → Project → Settings → Environment Variables (Production), set at minimum:

| Name | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wjlaaluonxiaxmytiqwi.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only |
| `STRIPE_SECRET_KEY` | LIVE key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | from Stripe Dashboard endpoint |
| `REGISTRATION_FEE_CENTS` | e.g. `25000` |
| `COGIC_CREDENTIAL_SESSION_SECRET` | ≥ 32 chars; dedicated secret |
| `NEXT_PUBLIC_APP_URL` | `https://<production-host>` |
| `COGIC_STREAM_PUBLIC_WEB_ORIGIN` | `https://<production-host>` (preferred for QR) |
| `ADMIN_EMAILS` | comma-separated owner emails |
| `REDIS_URL` or `UPSTASH_REDIS_URL` or `RATE_LIMIT_REDIS_URL` | distributed rate limiting |
| `TOKEN_ENCRYPTION_KEY` | if stream-key encrypt/save is used |

Also ensure:

- `LIVE_ACCESS_DEV_BYPASS` is **false or unset**
- `OPS_ADMIN_DEV_BYPASS` is **false or unset**

---

## 3. Production HTTPS domain

1. Attach the production domain in Vercel.
2. Confirm HTTPS certificate is valid.
3. Set both `NEXT_PUBLIC_APP_URL` and `COGIC_STREAM_PUBLIC_WEB_ORIGIN` to that HTTPS origin.
4. Redeploy after env changes.

---

## 4. Supabase project confirmation

1. Open https://supabase.com/dashboard/project/wjlaaluonxiaxmytiqwi
2. Confirm Production app env points only at this project.
3. Confirm registration / credential tables and RPCs from Phase 7 remain present.

---

## 5. Supabase Auth redirect URLs

Add production callbacks under Authentication → URL Configuration:

- `https://<production-host>/auth/callback`
- `https://<production-host>/auth/callback?next=/attendee-dashboard`
- `https://<production-host>/forgot-password`
- `https://<production-host>/reset-password`

---

## 6–8. Stripe LIVE webhook

1. Stripe Dashboard (LIVE mode) → Developers → Webhooks → Add endpoint
2. Endpoint URL:

```text
https://<production-host>/api/webhooks/stripe
```

3. Required event (minimum):
   - `checkout.session.completed`
4. Copy the endpoint signing secret into Vercel `STRIPE_WEBHOOK_SECRET` (Production).
5. Redeploy so the new secret is live.
6. Use Stripe “Send test event” only if it does not create unintended live financial side effects; prefer a controlled $0/test path only when approved. Do **not** auto-charge attendees from this runbook.

---

## 9. Registration fee verification

1. Confirm `REGISTRATION_FEE_CENTS` in Production matches the approved fee.
2. Hit `/api/health` and confirm `registrationPricingConfigured: true`.
3. Optionally run:

```bash
node scripts/verify-phase7-registration-live.mjs
node scripts/verify-phase8-production.mjs
```

---

## 10. Credential session secret readiness

1. Generate a dedicated secret (≥ 32 chars).
2. Set `COGIC_CREDENTIAL_SESSION_SECRET` in Production only (do not reuse Stripe/Supabase secrets).
3. Redeploy.
4. Confirm `/api/health` → `credentialSessionConfigured: true`.

---

## 11. ADMIN_EMAILS verification

1. Ensure operator emails are listed in `ADMIN_EMAILS`.
2. Sign in with an admin email and confirm owner/control routes resolve as expected.
3. Confirm a non-admin attendee cannot access owner controls.

---

## 12. Confirm dev bypasses disabled

Production must have:

- `LIVE_ACCESS_DEV_BYPASS` false/unset
- `OPS_ADMIN_DEV_BYPASS` false/unset

`/api/health` reports:

- `liveAccessDevBypassDisabled: true`
- `opsAdminDevBypassDisabled: true`

---

## 13–14. Service-role rotation (MANUAL OPERATOR ACTION REQUIRED)

**Do not auto-rotate.**

### Where configured

- Supabase Dashboard → Project Settings → API Keys → `service_role`
- Vercel Production env: `SUPABASE_SERVICE_ROLE_KEY`
- Local `.env.local` (developer machines only)

### Rotation sequence

1. Create/rotate the service-role key in Supabase Dashboard.
2. Update Vercel Production `SUPABASE_SERVICE_ROLE_KEY` first.
3. Redeploy Production immediately.
4. Update any authorized local operator `.env.local` copies.
5. Revoke/disable the previous key in Supabase only after Production is healthy.

### Post-rotation verification

- `/api/health` → `supabaseConfigured: true`
- Registration checkout still creates sessions
- Stripe webhook still fulfills (no 500s from service-role auth)
- Credential ingress still resolves

### Rollback

1. Restore previous `SUPABASE_SERVICE_ROLE_KEY` in Vercel (if still valid).
2. Redeploy.
3. Re-check `/api/health` and a smoke registration/webhook path.

---

## 15–18. Physical QR / device acceptance

**Do not fabricate credentials or place live charges from automation.**

Use a real confirmed registration + issued credential.

### Required checks

- [ ] QR generated from a real confirmed registration
- [ ] Scan with **iPhone** Camera
- [ ] Scan with **Android** Camera
- [ ] Opens **HTTPS** production host
- [ ] `/c/<token>` ingress succeeds
- [ ] Secure credential session established (HttpOnly cookie path `/c`)
- [ ] Raw token removed from subsequent visible navigation (lands on `/c`)
- [ ] Credential page renders properly
- [ ] Invalid token rejected / unavailable UI
- [ ] Expired/reissued credential handled correctly
- [ ] No sensitive token in server logs
- [ ] No unexpected authentication loop
- [ ] Readable at realistic badge-print size
- [ ] Desktop/browser open of the same HTTPS URL works

---

## 19. Registration → payment → credential validation

Operator-controlled end-to-end (live charge only when intentionally approved):

1. Authenticated attendee completes `/register` → `/register/review`
2. `POST /api/registration/checkout` returns Stripe Checkout URL
3. Complete payment in Stripe LIVE
4. Webhook `checkout.session.completed` fulfills registration
5. Credential issued; QR points at `https://<production-host>/c/<token>`
6. Device scan validates as above
7. `/my-convocation` reflects confirmed registration

---

## 20. App rollback procedure

1. In Vercel → Deployments, promote the last known-good Production deployment.
2. Confirm `/api/health` readiness.
3. Confirm `/program`, `/live`, `/c`, registration review still load.
4. If env vars caused the failure, restore prior env values and redeploy.

---

## 21. Webhook rollback / recovery

1. If fulfillment fails, inspect Stripe webhook delivery logs (no secrets in screenshots/chat).
2. Confirm endpoint URL still points to `https://<production-host>/api/webhooks/stripe`.
3. Confirm `STRIPE_WEBHOOK_SECRET` matches the LIVE endpoint.
4. Replay the failed `checkout.session.completed` event from Stripe after code/env fix (idempotent fulfillment should acknowledge duplicates).
5. If a bad deploy broke the route, roll back the app deploy first, then replay.

---

## 22. Production health endpoint

```bash
curl -sS https://<production-host>/api/health
curl -sS https://<production-host>/api/health?live=1
```

Expect readiness booleans only — never secret values.

---

## 23. Post-deployment smoke tests

- [ ] `/program`
- [ ] `/register`
- [ ] `/register/review`
- [ ] `/my-convocation`
- [ ] `/live`
- [ ] `/c` (clean unavailable state)
- [ ] `/api/health`
- [ ] `/api/registration/checkout` (auth required; no unauthenticated success)
- [ ] `/api/webhooks/stripe` rejects unsigned requests
- [ ] Phase 6B verifier (env permitting)
- [ ] Phase 7 verifier (env permitting)
- [ ] Phase 8 verifier (env permitting)

---

## Distributed rate limiting operator note

Credential ingress and registration checkout use Redis via `REDIS_URL` / `UPSTASH_REDIS_URL` / `RATE_LIMIT_REDIS_URL` (`ioredis`).

- When configured: limits are enforced across Vercel instances.
- When unset: limiters **fail open** (requests allowed) and `/api/health` reports `rateLimitConfigured: false`.
- Production launch should configure Redis/Upstash before heavy public traffic.
