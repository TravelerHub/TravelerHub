-- Table to store favorite places
CREATE TABLE IF NOT EXISTS favorite_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id VARCHAR(255) NOT NULL,
    place_name VARCHAR(255) NOT NULL,
    place_address TEXT,
    coordinates POINT NOT NULL,
    category VARCHAR(100),
    photos JSONB,
    rating DECIMAL(3,2),
    user_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, place_id)
);

-- Index for faster lookups
CREATE INDEX idx_favorite_places_user ON favorite_places(user_id);
CREATE INDEX idx_favorite_places_coords ON favorite_places USING GIST(coordinates);