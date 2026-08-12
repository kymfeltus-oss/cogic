# COGIC Travel Live Plumbing

Authoritative dual-lane architecture for `/travel` after Phases 1–3 gap closure.

- **Lane B (marketplace):** in-app Stripe Elements is the sole money authority path → server-repriced PaymentIntent → supplier book → ledger `CONFIRMED`
- **Lane A (official COGIC hotels):** browse-and-request interest only — no in-app payment, no CRS confirmation, no owner verify bypass

Schema foundation: `supabase/migrations/20260811000000_travel_transactional_core.sql`, plus coordinates, ops supplier events, and repair migrations.

## Authority model

| Authority | Source of truth |
| --- | --- |
| Identity | Server session via `resolveAuthenticatedBuyer` — never client `userId` |
| Money | Live Expedia Rapid price-check / Duffel offer retrieve — never client totals |
| Hotel/car rate identity | Exact `bookToken` equality after Expedia price-check (`assertExactBookTokenMatch`) |
| Confirmation | Supplier confirmation string after paid fulfillment — never typed codes, redirects, or owner verify |
| Payment success | Stripe webhook `payment_intent.succeeded` when `metadata.checkout_type === travel_marketplace` (plus in-app `complete-booking`) |

**Hard rule:** browser redirects, client status fields, typed confirmation numbers, and owner `verify` never mark `CONFIRMED`. `CONFIRMED` requires a real `supplier_confirmation_number` (minimum 3 non-whitespace characters) on the marketplace attempt and ledger rows.

## Status machine

| Status | Meaning |
| --- | --- |
| `DRAFT` | Offer selected; no payment captured |
| `PAYMENT_PENDING` | PaymentIntent created; awaiting successful charge |
| `SUPPLIER_SUBMITTED` | Booking payload sent to Expedia Rapid / Duffel |
| `CONFIRMED` | Supplier confirmation captured |
| `FAILED` | Payment, supplier, or validation failure |
| `REFUNDED` | Booking reversed financially |

```text
DRAFT → PAYMENT_PENDING | SUPPLIER_SUBMITTED | FAILED
PAYMENT_PENDING → SUPPLIER_SUBMITTED | CONFIRMED | FAILED | REFUNDED
SUPPLIER_SUBMITTED → CONFIRMED | FAILED | REFUNDED
CONFIRMED → REFUNDED | FAILED
FAILED → DRAFT
REFUNDED → (terminal)
```

## Entry surfaces

| Surface | Path | Role |
| --- | --- | --- |
| Hub | `/travel` | Official rail + marketplace search tabs |
| Official hotels | `/travel/hotels`, `/travel/hotels/[hotelId]` | Browse inventory; save interest; contact housing |
| Marketplace checkout | `/travel/checkout/[offerId]` | Fresh Elements checkout (session stash holds offer identity only — never charge authority) |
| Resume checkout | `/travel/checkout/continue?attemptId=` | Session-less resume from server attempt / PaymentIntent |
| Confirmation | `/travel/confirmation` | Receipt + PDF from live ledger |
| My Trip | `/travel/trip` | Open PI resume + confirmed marketplace stays + official interest |
| Owner ops | `/owner/travel` | Inventory, ledger queues, supplier sync, Stripe refund, cancel |
| Legacy partner return page | `/travel/marketplace/return` | Soft land only: `attemptId` → continue checkout; else `/travel` |

## Lane A — Official COGIC hotels (browse-and-request)

1. Published `travel_hotels` catalog (not a live CRS).
2. Attendee CTAs: **Save housing interest**, **Contact COGIC Housing** (`housing@cogic.org`).
3. `POST /api/travel/hotel-booking/start` inserts `travel_hotel_booking_journeys` at `DRAFT` with `mode: "browse_and_request"`.
4. No PaymentIntent, no ledger charge, no supplier confirmation, no auto-redirect to marketplace checkout.
5. Full official book/pay remains **BLOCKED — OPERATOR ACTION REQUIRED** until a live housing CRS exists (`cogicHousingAutomationAvailable() === false`).
6. Owner may cancel `travel_hotel_reservations`; owner verify/confirm returns **HTTP 410**.

## Lane B — Marketplace (sole transactional money path)

| Kind | Search + fulfill |
| --- | --- |
| Hotels | Expedia Rapid |
| Cars | Expedia Rapid |
| Flights | Duffel |

Enterprise Amadeus may appear in owner diagnostics only — never in the checkoutable search stream.

### Create-intent (server reprice)

```text
Search → Checkout CTA → /travel/checkout/[offerId]
  → POST /api/travel/checkout/create-intent
      1. evaluateCheckoutAuthorityGate rejects client money / identity fields (HTTP 400)
      2. resolveAuthenticatedBuyer (session identity)
      3. Hotels/cars: Expedia price-check + assertExactBookTokenMatch(requested, live)
         Flights: Duffel offer retrieve
      4. selectAuthoritativeFareCents(liveFare) — client offer totals ignored
      5. insert DRAFT attempt + travel_booking_transactions ledger row
      6. Stripe PaymentIntent (metadata below) → PAYMENT_PENDING
  → Stripe Elements pay
  → POST /api/travel/checkout/complete-booking and/or webhook payment_intent.succeeded
  → fulfillPaidTravelCheckout
  → SUPPLIER_SUBMITTED → bookExpediaHotel|bookExpediaCar|createDuffelOrder
  → CONFIRMED + supplier_confirmation_number
  → /travel/confirmation → /travel/trip
```

### Resume (database-level, no sessionStorage)

```text
My Trip → /travel/checkout/continue?attemptId=
  → POST /api/travel/checkout/resume  (attemptId only; money/snapshot injection rejected)
      • PAYMENT_PENDING + usable PI → reuse server client_secret + itemization from attempt/PI
      • DRAFT / unusable PI → createTravelCheckoutIntent (live reprice)
          → retireSupersededCheckoutAttempt(prior)
          → retireOpenDuplicateCheckoutAttempts(userId, offerId, exceptAttemptId)
            (marks other open DRAFT / PAYMENT_PENDING siblings FAILED; never touches
             CONFIRMED / SUPPLIER_SUBMITTED / REFUNDED)
  → UI binds fare / tax / fee / total exclusively from server resume payload
```

## Stripe webhook events and metadata

Endpoint: `POST /api/webhooks/stripe`  
Constant: `TRAVEL_CHECKOUT_TYPE = "travel_marketplace"` (`lib/travel/checkout/constants.ts`)

### PaymentIntent metadata (server-bound at create)

| Key | Value |
| --- | --- |
| `checkout_type` | `travel_marketplace` |
| `user_id` | Authenticated buyer id |
| `email` | Buyer email |
| `attempt_id` | `travel_marketplace_booking_attempts.id` |
| `transaction_id` | `travel_booking_transactions.id` |
| `kind` | `hotel` \| `flight` \| `car` |
| `provider` | Provider key (e.g. expedia-rapid, duffel) |
| `amount_cents` | Stringified charged total in cents |

Idempotency key for create: `travel-pi-{attemptId}`.

### Events the travel ledger consumes

| Event | Behavior when `checkout_type=travel_marketplace` |
| --- | --- |
| `payment_intent.succeeded` | `fulfillPaidTravelCheckout` → supplier book → `CONFIRMED` (or auto-refund + `FAILED`/`REFUNDED` on supplier failure) |
| `payment_intent.payment_failed` | Attempt + ledger advanced to `FAILED` when still `DRAFT` / `PAYMENT_PENDING` |

Refunds created by the travel stack also stamp `checkout_type=travel_marketplace` and `attempt_id` on the Stripe Refund metadata.

### Optional supplier change webhooks

Endpoint: `POST /api/travel/webhooks/supplier`  
Auth: HMAC with `TRAVEL_SUPPLIER_WEBHOOK_SECRET`  
Persists `travel_supplier_change_events` for My Trip / owner visibility. Never confirmation authority.

## Retired surfaces

**Deleted from the filesystem (no handlers):**

- `app/api/travel/marketplace/booking/start/`
- `app/api/travel/marketplace/booking/return/`

**HTTP 410 quarantine (lightweight stubs):**

- `GET|POST|PUT|PATCH /api/travel/marketplace/booking/confirm` (`manual_confirm_retired`)
- `GET|POST|PUT|PATCH /api/travel/marketplace/booking/recheck` (`recheck_retired`)
- `POST /api/travel/reservations` (attendee-typed confirmation)
- Owner `PATCH /api/owner/travel` with `verify` / `confirm` / `approve` / `mark_verified` / `manual_confirm` (`owner_verify_retired`)
- Owner ops `verify` / `confirm` actions (`owner_verify_retired`)

## Schema lineage

- Catalog: `travel_hotels`, room types, nightly availability, airports, transport, announcements
- Marketplace machine: `travel_marketplace_booking_attempts`
- Official interest: `travel_hotel_booking_journeys` (`DRAFT`, browse-and-request)
- Ledger: `travel_booking_transactions` + `travel_booking_transaction_events`
- Capture: `travel_hotel_reservations`, `user_trip_*`
- Ops feed: `travel_supplier_change_events`
- Telemetry: `travel_analytics_events` (never confirmation authority)

## Owner / attendee parity

| Attendee | Owner |
| --- | --- |
| Search + in-app Elements checkout + session-less resume | Ledger queues, `sync_supplier_status`, Stripe refund |
| Official save interest + contact housing | Publish inventory / availability date ranges |
| View confirmation / PDF receipt | Cancel reservations only (verify retired HTTP 410) |

## Sandbox interceptors (USE_MOCK_TRAVEL)

Developers and non-production cloud vaults may exercise create-intent / server reprice without live Expedia Rapid or Duffel network calls by setting:

```bash
USE_MOCK_TRAVEL=true
```

| Where to set | Guidance |
| --- | --- |
| Local | `.env.local` for `next dev`, then restart the dev server |
| Cloud vault | Preview / staging project env only — never Vercel Production |
| Production host | Must remain unset or `false`. `VERCEL_ENV=production` hard-disables the interceptors even if the flag is present |

| Guard | Behavior |
| --- | --- |
| `process.env.USE_MOCK_TRAVEL === "true"` | Entry interceptor in `priceCheckExpediaHotel`, `priceCheckExpediaCar`, `getDuffelOffer` |
| `travelDemoModeEnabled()` | True only when the flag is exactly `true` and `VERCEL_ENV` is not `production` |
| Vercel Preview note | Preview often sets `NODE_ENV=production`; that alone does **not** block sandbox |

| Interceptor | Sandbox frame (typed) |
| --- | --- |
| Hotel price-check | `totalRateCents` / `totalAmountCents` = `15000`, `bookToken` = `mock_sandbox_token_hotel_9982` |
| Car price-check | `totalRateCents` / `totalAmountCents` = `7500`, `bookToken` = `mock_sandbox_token_car_4412` |
| Duffel offer retrieve | `totalFareCents` / `totalAmountCents` = `32050`, `id` = `mock_sandbox_offer_flight_2201` |

While sandbox is active, `expediaRapidConfigured()` / `duffelConfigured()` report configured so create-intent can proceed, and create-intent accepts the static demo `bookToken`. Search inventory, Stripe PaymentIntents, and supplier book/fulfill are **not** mocked — supplier book after a sandbox charge fails honestly (Law 22) unless real partner credentials are present.

Toggle off with `USE_MOCK_TRAVEL=false` (or remove the variable) and redeploy / restart.

## Operator gate

Credentials, migrations, Stripe webhook wiring, and the operator Smoke Test Checklist live in `env.travel.example`.  
Contract / runtime coverage: `lib/travel/__tests__/runtime-integration.test.ts` and related travel contract suites.

**Production PASS** requires the operator smoke checklist to clear on the target Supabase project with live Expedia / Duffel / Stripe credentials. Code completeness alone is not enough (Law 24 / Law 25). `USE_MOCK_TRAVEL` never counts as production PASS.
