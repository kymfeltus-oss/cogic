# Tax-Exempt Cloud Infrastructure Runbook (Track 1)

Unblocks `POST /api/travel/corporate/tax-exempt/upload` and certificate confirmation.

Upload authority: **service_role** signed URLs from Next.js — not direct client bucket access.

## Apply order

Run migrations sequentially on the **same** Supabase project as production/preview app env:

1. `20260811000100_church_organizations_and_roles.sql` — `is_church_leadership_member()`
2. `20260811000400_church_tax_exempt_profiles.sql` — table + bucket + RLS

Verify with:

```bash
psql "$DATABASE_URL" -f scripts/verify-tax-exempt-cloud.sql
```

Or paste `scripts/verify-tax-exempt-cloud.sql` into the Supabase SQL editor.

## What migration 00400 provisions

### `public.church_tax_profiles`

| Control | Policy |
| --- | --- |
| RLS | `ENABLE` + `FORCE` |
| `anon` | `REVOKE ALL` |
| `authenticated` | `GRANT SELECT` only |
| `service_role` | `GRANT ALL` (API mutators) |
| SELECT policy | `church_tax_profiles_select_member_or_owner` — church member **or** `is_application_owner()` |

Mutations (insert/update upload fields, owner verify) go through Next.js using **service_role** — never client JWT writes.

### Storage bucket `tax-exempt-certificates`

| Setting | Value |
| --- | --- |
| `public` | `false` |
| `file_size_limit` | `10485760` (10 MB) |
| `allowed_mime_types` | `application/pdf`, `image/jpeg`, `image/png` |

Object path layout: `{church_id}/{profile_id}/certificate.{pdf|jpg|png}`

### Storage RLS (`storage.objects`)

| Policy | Role | Command | Rule |
| --- | --- | --- | --- |
| `tax_exempt_certificates_select_leader_or_owner` | `authenticated` | `SELECT` | `bucket_id = 'tax-exempt-certificates'` AND (`is_application_owner()` OR `is_church_leadership_member(tax_cert_path_church_id(name))`) |
| `tax_exempt_certificates_service_all` | `service_role` | `ALL` | `bucket_id = 'tax-exempt-certificates'` |

**Upload path:** `createSignedUploadUrl` runs as **service_role** in the upload route — no authenticated INSERT policy is required.

## App environment (Next.js)

Required server env (never expose to client):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role secret>
```

Optional owner gate:

```sql
ALTER ROLE authenticator SET app.admin_emails = 'owner@example.org';
```

## Smoke checklist

1. Pastor/Overseer session → `GET /api/travel/corporate/tax-exempt` → **200** with `canUpload: true` when unseeded.
2. `POST /api/travel/corporate/tax-exempt/upload` → **201** with `signedUrl`, `path`, `bucket`.
3. Client `PUT` bytes to `signedUrl`.
4. `POST /api/travel/corporate/tax-exempt/confirm` → **200**, status `pending_review`.
5. Owner `PATCH /api/owner/travel/corporate/tax-exempt/review` → `verified`.

## Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `relation "church_tax_profiles" does not exist` (42P01) | Migration 00400 not applied | Apply migration |
| `Unable to create signed upload URL` | Bucket missing | Re-run bucket INSERT from 00400 or create bucket in dashboard with exact id `tax-exempt-certificates` |
| Upload 403 | User not Pastor/Overseer | Assign `church_memberships` role |
| Confirm 404 | Bytes not in storage | Complete PUT to signed URL before confirm |

## Operator smoke automation

See `scripts/smoke/tax-exempt-operator-smoke.mjs` (Track 3) for PATCH verify/reject without UI clicks — requires real `pending_review` rows with uploaded certificates.
