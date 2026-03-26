-- Upgrade existing polls / poll_options / poll_votes tables
-- to support the group voting feature.
-- Safe to run on a DB that already has these tables.

-- ── polls: add poll_type, status, winner_option_id ────────────────────────────

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS poll_type   TEXT    DEFAULT 'activity'
      CHECK (poll_type IN ('length_of_stay', 'location', 'activity')),
  ADD COLUMN IF NOT EXISTS status      TEXT    NOT NULL DEFAULT 'open'
      CHECK (status IN ('open', 'closed')),
  ADD COLUMN IF NOT EXISTS winner_option_id UUID;

-- ── poll_options: add created_by, label, value, vote_count, ai_suggested ──────

ALTER TABLE public.poll_options
  ADD COLUMN IF NOT EXISTS created_by  UUID    REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS label       TEXT,
  ADD COLUMN IF NOT EXISTS value       JSONB   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vote_count  INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_suggested BOOLEAN NOT NULL DEFAULT false;

-- ── poll_votes: enforce one vote per user per poll ────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'poll_votes_unique_user_poll'
  ) THEN
    ALTER TABLE public.poll_votes
      ADD CONSTRAINT poll_votes_unique_user_poll UNIQUE (poll_id, user_id);
  END IF;
END $$;

-- ── Indexes (IF NOT EXISTS — safe to re-run) ──────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_polls_trip        ON public.polls(trip_id);
CREATE INDEX IF NOT EXISTS idx_polls_created_by  ON public.polls(created_by);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON public.poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll   ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user   ON public.poll_votes(user_id);
