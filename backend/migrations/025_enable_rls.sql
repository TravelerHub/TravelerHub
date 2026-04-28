-- 025_enable_rls.sql
--
-- Re-enables Row-Level Security on every user-data table that the app
-- writes to. The `SETUP.md` guide tells operators they can disable RLS while
-- iterating on a development project; this migration is the safety net that
-- gets shipped before going public so a misconfigured prod is never wide
-- open. Run *after* all earlier migrations.
--
-- IMPORTANT:
--   - Most tables already ship with policies in earlier migrations
--     (see 011_group_sharing_foundation.sql onwards).
--   - This file only flips the table-level switch — it does NOT replace
--     existing policies.
--   - A few low-risk reference tables (e.g. card_presets) are intentionally
--     left RLS-off so anonymous users can still read them. Add to the
--     EXCLUDE block below if you intend to keep RLS off for a reason.
--   - The backend talks to Supabase using the SERVICE_ROLE key, which
--     bypasses RLS. RLS only protects requests that reach Supabase via the
--     anon/authenticated roles (e.g. the frontend's direct realtime
--     subscriptions). Keep that in mind when auditing.

DO $$
DECLARE
    t text;
    -- Tables that intentionally stay RLS-off (currency lookups, etc.).
    -- Edit this list rather than removing the migration.
    skip_tables text[] := ARRAY[
        'card_presets'
    ];
BEGIN
    FOR t IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT LIKE 'pg_%'
          AND tablename NOT LIKE 'sql_%'
          AND tablename != ALL(skip_tables)
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Sanity check: surface any remaining RLS-off tables in the migration log
-- so the operator notices if a brand-new table got missed by the loop.
DO $$
DECLARE
    leaky text;
BEGIN
    FOR leaky IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND NOT c.relrowsecurity
          AND c.relname NOT IN ('card_presets')
    LOOP
        RAISE NOTICE 'Table public.% still has RLS disabled', leaky;
    END LOOP;
END $$;
