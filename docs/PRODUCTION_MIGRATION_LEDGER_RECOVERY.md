# Production migration ledger recovery

No repair or migration execution is authorized during this evidence step.

1. Open the Supabase dashboard for project `wjlaaluonxiaxmytiqwi`.
2. Open **SQL Editor**.
3. Open `scripts/verify-production-migration-state.sql` from this repository and copy its complete contents.
4. Paste it into SQL Editor and run it. The script is read-only catalog introspection; it contains no database mutations or DDL.
5. Export or copy the complete result set without removing long function, policy, constraint, index, trigger, grant, bucket, backfill, enum, or ledger definitions.
6. Return the complete results to Codex for comparison with `docs/production-migration-verification-manifest.md` and the original migration SQL.

Do not use **Repair migration history**, do not run historical SQL, and do not apply the media migration during this step.
