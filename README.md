# Parable (300 Awakening)

Next.js app with Supabase Postgres and a FastAPI audio driver service.

## Database migrations

Parable uses **Supabase SQL migrations** in `supabase/migrations/`. This is the only migration system for application data.

### Rule

**Never reference a new database column in frontend or backend code until the migration has been created and applied.**

Workflow:

1. [Database migration checklist](./docs/database-migration-checklist.md)
2. [Database migrations guide](./docs/database-migrations.md)

Quick commands:

```bash
npm run db:migration:new -- my_change_name   # create migration files
npm run db:migrate -- supabase/migrations/20260630120000_mixers_schema_sync.sql
npm run db:schema:reload                     # refresh PostgREST schema cache
npm run db:verify:mixers                     # confirm mixers columns exist
```

## Development

```bash
npm install
npm run dev
```

Audio backend (optional, for live mixer control):

```bash
docker compose up backend
```
