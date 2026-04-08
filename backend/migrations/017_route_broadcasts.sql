-- Route broadcast table for Supabase Realtime.
-- When a smart route is planned for a group, the summary is upserted here.
-- Frontend subscribes to changes on this table to get live route updates.

CREATE TABLE IF NOT EXISTS public.route_broadcasts (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id     UUID NOT NULL UNIQUE,
    planned_by  UUID NOT NULL,
    route_summary JSONB NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_broadcasts_trip ON public.route_broadcasts (trip_id);

-- Enable Supabase Realtime (run in SQL editor):
-- ALTER PUBLICATION supabase_realtime ADD TABLE route_broadcasts;
