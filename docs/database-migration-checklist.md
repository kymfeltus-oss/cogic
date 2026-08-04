# Database migration checklist

Use this checklist **before merging any change** that adds or modifies database fields, tables, or relationships.

## Before adding any new database field

- [ ] Create migration (`npm run db:migration:new -- <short_name>`)
- [ ] Run migration locally or on linked Supabase (`npm run db:migrate -- <file.sql>`)
- [ ] Update TypeScript schema mirror (`lib/database/<table>.ts`)
- [ ] Update repository mapping (`lib/todays-service/repository.ts` or relevant repository)
- [ ] Update API/domain types (`lib/todays-service/types.ts` or feature types)
- [ ] Update API route handlers / service layer
- [ ] Update frontend TypeScript types that consume the API
- [ ] Update Python schema mirror if applicable (`backend/app/database/`)
- [ ] Test create
- [ ] Test update
- [ ] Test delete (if applicable)
- [ ] Test refresh persistence (reload page / new session)
- [ ] Confirm no schema cache errors (`npm run db:verify:mixers` for mixers)

## Rule

**Never reference a new database column in frontend or backend code until the migration has been created and applied.**

See [database-migrations.md](./database-migrations.md) for commands and architecture.
