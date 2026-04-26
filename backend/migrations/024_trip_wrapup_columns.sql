-- ============================================================
-- 024_trip_wrapup_columns.sql
-- Adds wrap-up columns to the trips table for the post-trip ritual flow.
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ============================================================

-- Trip lifecycle dates
ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS start_date   DATE,
    ADD COLUMN IF NOT EXISTS end_date     DATE,
    ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'archived')),
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS highlight_photo TEXT;

-- Index for dashboard "trips to wrap up" query
CREATE INDEX IF NOT EXISTS idx_trips_status_end_date
    ON public.trips(status, end_date);
