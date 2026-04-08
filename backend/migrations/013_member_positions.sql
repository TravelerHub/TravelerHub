-- Live group member position tracking for Group-Centric Search & Arrival Sync.
-- Stores the last-known position of each member within a trip.
-- Designed for UPSERT — one row per (trip_id, user_id).

CREATE TABLE IF NOT EXISTS public.member_positions (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id     UUID NOT NULL,
    user_id     UUID NOT NULL,
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    heading     DOUBLE PRECISION,
    accuracy    DOUBLE PRECISION,
    updated_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_pos_trip
    ON public.member_positions (trip_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_pos_user
    ON public.member_positions (user_id);

-- Enable Supabase Realtime so frontend can subscribe to position changes.
-- (Run this in the Supabase SQL editor — it requires superuser.)
-- ALTER PUBLICATION supabase_realtime ADD TABLE member_positions;
