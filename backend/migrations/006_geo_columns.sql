-- Add geo-tagging columns to expenses for map visualization
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS place_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS trip_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_expenses_geo ON expenses(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Add geo-tagging and trip association to images for photo-mapping
ALTER TABLE images ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE images ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE images ADD COLUMN IF NOT EXISTS trip_id UUID;
ALTER TABLE images ADD COLUMN IF NOT EXISTS caption TEXT;

CREATE INDEX IF NOT EXISTS idx_images_geo ON images(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_images_trip ON images(trip_id) WHERE trip_id IS NOT NULL;
