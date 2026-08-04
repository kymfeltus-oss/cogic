"""Database schema documentation for Parable.

Persistent data lives in Supabase PostgreSQL. Migrations are SQL files under
supabase/migrations/. The FastAPI audio service does not use SQLAlchemy for
mixers — it only talks to physical consoles. Next.js API routes persist via
Supabase service role.
"""
