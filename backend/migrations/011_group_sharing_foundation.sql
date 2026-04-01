-- Group sharing foundation for finance/chat/navigation
-- Safe migration: only adds missing columns/indexes.

-- 1) Ensure trip groups can be represented in group_member
ALTER TABLE public.group_member
  ADD COLUMN IF NOT EXISTS group_id UUID;

ALTER TABLE public.group_member
  ADD COLUMN IF NOT EXISTS join_datetime TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.group_member
  ADD COLUMN IF NOT EXISTS left_datetime TIMESTAMPTZ;

-- 2) Ensure conversation can be scoped to a trip/group
ALTER TABLE public.conversation
  ADD COLUMN IF NOT EXISTS trip_id UUID;

-- 3) Helpful indexes for new group-scoped queries
CREATE INDEX IF NOT EXISTS idx_group_member_group_user_active
  ON public.group_member(group_id, user_id)
  WHERE left_datetime IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_trip_id
  ON public.conversation(trip_id);

CREATE INDEX IF NOT EXISTS idx_expenses_trip_id
  ON public.expenses(trip_id);

CREATE INDEX IF NOT EXISTS idx_saved_routes_trip_id
  ON public.saved_routes(trip_id);
