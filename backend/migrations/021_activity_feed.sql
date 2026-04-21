-- Activity feed: log social events across all trip features
-- Each event records who did what in which trip, with optional metadata
CREATE TABLE IF NOT EXISTS trip_activity (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action      TEXT NOT NULL,  -- e.g. 'voted', 'added_photo', 'checked_task', 'added_expense', 'pinned_location'
    subject     TEXT,           -- e.g. 'Paris', 'Eiffel Tower photo', 'Hotel booking'
    meta        JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_activity_trip_id ON trip_activity(trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_activity_user_id ON trip_activity(user_id);

-- Realtime: enable so feed updates live for all group members
ALTER PUBLICATION supabase_realtime ADD TABLE trip_activity;


-- Photo comments
CREATE TABLE IF NOT EXISTS media_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id    UUID NOT NULL REFERENCES trip_media(id) ON DELETE CASCADE,
    trip_id     UUID NOT NULL,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL CHECK (char_length(body) <= 500),
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_comments_media_id ON media_comments(media_id, created_at);


-- Trip todos (shared, group-synced — replaces the localStorage-only Todo page)
CREATE TABLE IF NOT EXISTS trip_todos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text        TEXT NOT NULL CHECK (char_length(text) <= 500),
    priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
    category    TEXT NOT NULL DEFAULT 'other',
    due_date    DATE,
    done        BOOLEAN NOT NULL DEFAULT FALSE,
    done_by     UUID REFERENCES users(id),
    done_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_todos_trip_id ON trip_todos(trip_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE trip_todos;
