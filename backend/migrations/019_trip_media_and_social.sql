-- Trip media gallery + social features (UC#6)
-- Photos, likes, saves/bookmarks

CREATE TABLE IF NOT EXISTS trip_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    uploaded_by UUID NOT NULL,
    uploaded_by_name TEXT,
    caption TEXT,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trip_media_trip ON trip_media(trip_id);
CREATE INDEX idx_trip_media_uploaded_by ON trip_media(uploaded_by);

-- Likes: one per user per photo
CREATE TABLE IF NOT EXISTS media_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    media_id UUID NOT NULL REFERENCES trip_media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (media_id, user_id)
);

CREATE INDEX idx_media_likes_media ON media_likes(media_id);

-- Saves/bookmarks: user's personal collection
CREATE TABLE IF NOT EXISTS media_saves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    media_id UUID NOT NULL REFERENCES trip_media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (media_id, user_id)
);

CREATE INDEX idx_media_saves_user ON media_saves(user_id);
