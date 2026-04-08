-- Ranked-Choice (Borda Count) polling and Group Social Contract.
--
-- Extends the existing polls system (008/009) with:
--   1. ranked_choice poll type
--   2. A ranked_votes table (stores rank per option per user)
--   3. A group_settings table for the "Social Contract" (vote_mode, veto rules)
--   4. A vote_history table to power the "Frustration Index"

-- ── 1. Allow ranked_choice as a poll_type ────────────────────────────────────

ALTER TABLE public.polls
    DROP CONSTRAINT IF EXISTS polls_poll_type_check;

ALTER TABLE public.polls
    ADD CONSTRAINT polls_poll_type_check
    CHECK (poll_type IN ('length_of_stay', 'location', 'activity', 'other', 'ranked_choice'));

-- ── 2. Ranked votes (Borda Count) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ranked_votes (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id     UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    option_id   UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    rank        INT NOT NULL CHECK (rank >= 1),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (poll_id, user_id, option_id),
    UNIQUE (poll_id, user_id, rank)          -- each rank used only once per user
);

CREATE INDEX IF NOT EXISTS idx_ranked_votes_poll ON public.ranked_votes (poll_id);
CREATE INDEX IF NOT EXISTS idx_ranked_votes_user ON public.ranked_votes (user_id);

-- ── 3. Group Social Contract settings ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.group_settings (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id     UUID NOT NULL UNIQUE,
    vote_mode   TEXT NOT NULL DEFAULT 'majority'
                CHECK (vote_mode IN ('majority', 'unanimous', 'leader_decides')),
    veto_enabled BOOLEAN NOT NULL DEFAULT true,
    -- Veto scope: which preference types can block a group decision
    veto_scope  TEXT[] DEFAULT ARRAY['tolls', 'dietary_restrictions', 'avoid_types'],
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_settings_trip ON public.group_settings (trip_id);

-- ── 4. Vote history for Frustration Index ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vote_history (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id       UUID NOT NULL,
    poll_id       UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL,
    voted_for_winner BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vote_history_user_trip
    ON public.vote_history (user_id, trip_id, created_at DESC);
