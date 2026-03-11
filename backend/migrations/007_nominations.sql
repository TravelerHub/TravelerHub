-- Place nominations for collaborative decision-making (shortlist buffer)
CREATE TABLE IF NOT EXISTS place_nominations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL,
    group_id TEXT NOT NULL,
    nominated_by UUID NOT NULL,
    place_name TEXT NOT NULL,
    place_address TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    category TEXT,
    note TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_nominations_trip ON place_nominations(trip_id);
CREATE INDEX idx_nominations_group ON place_nominations(group_id);

-- Votes on place nominations (up/down voting)
CREATE TABLE IF NOT EXISTS place_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nomination_id UUID NOT NULL REFERENCES place_nominations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    vote INT NOT NULL CHECK (vote IN (-1, 1)),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(nomination_id, user_id)
);

CREATE INDEX idx_votes_nomination ON place_votes(nomination_id);

-- Auto-approve nominations that reach a vote threshold
-- (handled in application logic, not a trigger, for flexibility)
