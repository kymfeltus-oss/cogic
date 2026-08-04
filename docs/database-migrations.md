# Database migrations (Parable)

## System in use

Parable uses **Supabase PostgreSQL** with **versioned SQL migrations** in:

```
supabase/migrations/
```

| Layer | Tool | Role |
|-------|------|------|
| Database | Supabase Postgres | Source of truth for schema |
| Migrations | Supabase CLI + SQL files | Versioned schema changes |
| App persistence | Next.js + `@supabase/supabase-js` | CRUD via service role |
| Audio drivers | FastAPI (Python) | Mixer console I/O only — **no SQLAlchemy / no Alembic** |

There is **one** migration system. Do not add Prisma, Drizzle, or Alembic for the same tables.

## Prerequisites

1. [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`npx supabase --version`)
2. Project linked: `npx supabase link --project-ref <your-ref>` (link metadata stored under `supabase/.temp/`)
3. Environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Create a migration

```bash
npm run db:migration:new -- add_cameras_ptz_column
```

Creates:

- `supabase/migrations/YYYYMMDDHHMMSS_add_cameras_ptz_column.sql`
- `supabase/migrations/YYYYMMDDHHMMSS_add_cameras_ptz_column.down.sql`

Edit the `.sql` file. Use `ADD COLUMN IF NOT EXISTS` when altering existing tables so idempotent replays are safe.

Always end migrations that change exposed tables with:

```sql
NOTIFY pgrst, 'reload schema';
```

## Run a migration

### Linked remote project (recommended)

```bash
npm run db:migrate -- supabase/migrations/20260630120000_mixers_schema_sync.sql
```

Or directly:

```bash
npx supabase db query --linked -f supabase/migrations/YYYYMMDDHHMMSS_your_migration.sql
```

### Supabase SQL Editor

Paste the migration file contents into the Supabase Dashboard → SQL Editor → Run.

### Full push (only when local/remote migration history match)

```bash
npx supabase db push
```

If you see *Remote migration versions not found in local migrations directory*, use `db query --linked -f` for individual files instead of `db push`, or run `supabase migration repair` after consulting Supabase docs.

## Rollback a migration

Run the paired `.down.sql` file:

```bash
npm run db:migrate -- supabase/migrations/YYYYMMDDHHMMSS_your_migration.down.sql
```

Review the down file before running — some rollbacks are partial.

## Refresh schema cache (Supabase / PostgREST)

After DDL changes:

```bash
npm run db:schema:reload
```

Or include in your migration:

```sql
NOTIFY pgrst, 'reload schema';
```

If errors persist, restart the Next.js dev server (`npm run dev`).

## Restart backend server

The FastAPI audio service does not cache Postgres schema. Restart only when changing Python code:

```bash
# docker-compose
docker compose restart backend

# or local uvicorn
cd backend && uvicorn app.main:app --reload
```

## Verify schema

Check mixers table columns on linked project:

```bash
npm run db:verify:mixers
```

## Code sync after migration

1. **`lib/database/<table>.ts`** — column names and row type (TypeScript mirror)
2. **`lib/todays-service/repository.ts`** — insert/update/select mapping
3. **`lib/todays-service/types.ts`** — domain/API types
4. **`backend/app/database/<table>_record.py`** — Pydantic mirror (documentation / validation)

## Mixers table (current)

Canonical idempotent migration:

`supabase/migrations/20260630120000_mixers_schema_sync.sql`

Required columns (product name → DB column):

| Product | PostgreSQL column |
|---------|-------------------|
| church_id | `tenant_id` |
| connection_type | `connection_type` |
| ethernet_ip_address | `ethernet_ip_address` |
| firmware_version | `firmware_version` |
| imported_setup_json | `imported_setup_json` |

TypeScript mirror: `lib/database/mixers.ts`  
Python mirror: `backend/app/database/mixer_record.py`

## Troubleshooting

### `Could not find the '…' column of 'mixers' in the schema cache`

1. Migration not applied — run `20260630120000_mixers_schema_sync.sql`
2. Schema cache stale — `npm run db:schema:reload`
3. Code references column before migration merged — fix order per checklist

### Migration history mismatch

Use per-file apply via `db query --linked -f` until local and remote histories are reconciled.
