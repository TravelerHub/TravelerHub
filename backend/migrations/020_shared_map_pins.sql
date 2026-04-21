-- Shared Map Pins: real-time collaborative annotations visible to all group members.
-- This is the #1 differentiator over Google Maps / Waze for group travel:
-- any member drops a pin and every other member sees it instantly.
--
-- IMPORTANT: After running this migration, enable Supabase Realtime on this table:
--   In Supabase Dashboard → Database → Replication → supabase_realtime publication
--   ADD TABLE shared_map_pins;
-- Or run:  ALTER PUBLICATION supabase_realtime ADD TABLE shared_map_pins;

CREATE TABLE IF NOT EXISTS public.shared_map_pins (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id     UUID NOT NULL,
    user_id     UUID NOT NULL,
    username    TEXT,
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    title       TEXT NOT NULL,
    note        TEXT,
    emoji       TEXT NOT NULL DEFAULT '📍',
    color       TEXT NOT NULL DEFAULT '#183a37',
    upvoters    UUID[] NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_pins_trip
    ON public.shared_map_pins (trip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_pins_user
    ON public.shared_map_pins (user_id);

-- Enable Realtime (uncomment if running in Supabase SQL editor with superuser):
-- ALTER PUBLICATION supabase_realtime ADD TABLE shared_map_pins;
