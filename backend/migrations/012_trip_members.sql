-- Dedicated trip/group membership table
-- Keeps group sharing separate from chat's group_member conversation memberships.

CREATE TABLE IF NOT EXISTS public.trip_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    left_at TIMESTAMPTZ,
    UNIQUE (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_members_trip_active
  ON public.trip_members(trip_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trip_members_user_active
  ON public.trip_members(user_id)
  WHERE left_at IS NULL;
