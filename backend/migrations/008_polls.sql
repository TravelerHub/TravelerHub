-- Group voting / polls system
-- Three poll types: length_of_stay, location, activity

CREATE TABLE IF NOT EXISTS polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL,
    created_by UUID NOT NULL,
    poll_type TEXT NOT NULL CHECK (poll_type IN ('length_of_stay', 'location', 'activity')),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    winner_option_id UUID,          -- set when poll is closed
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polls_trip ON polls(trip_id);
CREATE INDEX IF NOT EXISTS idx_polls_created_by ON polls(created_by);

-- Options that members (or the AI) add to a poll
CREATE TABLE IF NOT EXISTS poll_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,
    label TEXT NOT NULL,
    value JSONB DEFAULT '{}',       -- extra metadata (days, place_id, address …)
    vote_count INT NOT NULL DEFAULT 0,
    ai_suggested BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);

-- One vote per user per poll (enforced by UNIQUE)
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(user_id);
