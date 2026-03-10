-- Migration 002: Add role column to group_member table
-- Run this in your Supabase SQL editor

ALTER TABLE group_member
ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'member'
CHECK (role IN ('leader', 'member'));

-- Optional: verify the column was added
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'group_member' AND column_name = 'role';
