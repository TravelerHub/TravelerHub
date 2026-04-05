-- Park & Walk auto-toggle and Silent Mode navigation preferences.

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS park_and_walk_auto BOOLEAN DEFAULT false;

-- Silent Mode: only high-priority alerts (hazards, closures), visual-only for group ETA
ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS silent_mode BOOLEAN DEFAULT false;
