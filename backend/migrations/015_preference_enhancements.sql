-- Add "Vibe" and "Energy" constraint columns to user_preferences.
-- These power the smart routing engine's spontaneity and pace logic.

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS travel_pace TEXT
        DEFAULT 'moderate'
        CHECK (travel_pace IN ('chill', 'moderate', 'packed'));

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS spontaneity_score INT
        DEFAULT 5
        CHECK (spontaneity_score BETWEEN 1 AND 10);
