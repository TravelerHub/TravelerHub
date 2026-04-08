-- Trip media / photo gallery (UC#6: Centralized Trip Photo)
-- Stores metadata for photos uploaded to Supabase Storage "Media" bucket

CREATE TABLE IF NOT EXISTS trip_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    uploaded_by UUID NOT NULL,
    uploaded_by_name TEXT,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trip_media_trip ON trip_media(trip_id);
CREATE INDEX idx_trip_media_uploaded_by ON trip_media(uploaded_by);
