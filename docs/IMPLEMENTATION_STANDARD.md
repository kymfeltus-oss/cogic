# COGIC LIVE — Implementation Standard

This document is the required method for every existing and future feature in this repository.

Related Cursor rule: `.cursor/rules/implementation-standard.mdc`

---

## 1. LIVE MODE ONLY

Never ship:

- mock / dummy / sample / demo / preview data in production UI
- fake success states, fake schedules, fake registrations, fake credentials
- fake giving totals, fake replays, fake viewer counts, fake notifications
- hard-coded privileged user or transaction outcomes

Every displayed value and actionable state must come from:

- the real database
- the real authenticated session
- the real API / server action
- real Stripe / payment infrastructure
- real published content records

If live data does not exist: show a truthful empty state. Do not invent completeness.

---

## 2. END-TO-END COMPLETION

A feature is incomplete until the full chain works:

User action → frontend validation → secure API/server action → database/payment operation → persistence → response → UI refresh → next route → downstream state correct.

Do not leave TODOs, stubs, dead buttons, unconnected forms, or UI without persistence.

---

## 3. INTERACTIVE UI

Every control must either:

- A) perform a real action, or
- B) navigate to a real functional destination

If functionality does not exist: remove or hide the control. Never leave decorative interactive chrome.

---

## 4. BACKEND / DATABASE / API

Where applicable, features require:

- real tables, relationships, constraints
- models/types and data access
- server-side services and secure routes/actions
- authentication, authorization, RLS
- validation, error handling, idempotency, audit fields

Never trust client-provided:

- user IDs, prices, payment amounts
- registration/credential status
- fund IDs, privileged roles

Resolve authoritative values server-side.

localStorage / in-memory state is never the source of truth for business state.

---

## 5. PAYMENTS

- Stripe webhook remains authoritative where implemented
- Amounts, funds, and metadata are bound server-side
- Signature verification and idempotency required
- Never mark paid from client redirect alone
- Never store full card numbers / CVC

---

## 6. CREDENTIALS / LIVE / SCHEDULE / REPLAYS / GIVING

- Credentials: real confirmed registration → real issue state → secure `/c/[token]` — no fake QR
- Live: show LIVE only when real stream/event state confirms it
- Schedule: published occurrence records only
- Replays: published catalog only; otherwise honest empty
- Giving: amount → fund → method → Stripe → webhook → recorded gift → success/failure

---

## 7. NOTIFICATIONS / SEARCH / SUPPORT

- Notifications: real system only; otherwise hide badge/actions
- Search: real searchable data only; otherwise hide control
- Support: use `NEXT_PUBLIC_SUPPORT_EMAIL` (or approved config). No `example.com` placeholders in production UX

---

## 8. AUTH / SECURITY

- Identity from server session only
- No cross-attendee access to registration/credential
- Admin/owner routes require server authorization
- Service role is server-only
- Dev bypasses must fail readiness / be disabled in production
- Rate limit high-risk routes; redact secrets; no stack traces to clients

---

## 9. FRONTEND QUALITY

Every screen must support loading, empty, error, and success states; remain responsive and accessible; refresh after mutations. Prefer server-side data fetching. Do not duplicate privileged business logic in the client.

---

## 10. TESTING & VERIFICATION

For every major feature verify:

UI entry → API → DB → auth boundary → mutation → DB state → refetch → UI → navigation → failure path

Before merge / launch:

1. Targeted tests for repaired areas
2. `npm test`
3. `npm run build`
4. Phase verifiers (`verify:phase6b`, `verify:phase7`, `verify:phase8`) when environment allows
5. `/api/health` readiness

---

## 11. BLOCKED WORK

If schema, credentials, operator approval, production content, or an external service is missing:

**BLOCKED — OPERATOR ACTION REQUIRED**

State exactly what is needed. Do not fake completion.

---

## 12. DEFINITION OF DONE

DONE only when:

- real data source, backend, persistence, and UI wiring exist
- every button works; validation/error/success/routing/auth work
- responsive + accessible behavior works
- tests and production build pass
- no mock/demo fallback remains in the user path
