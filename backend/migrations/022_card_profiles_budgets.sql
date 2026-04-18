-- Credit card profiles — each user stores their cards with cashback rates by category
-- category_rates is a JSONB map: { "dining": 4.0, "travel": 3.0, "groceries": 4.0, ... }
-- known_categories: dining, travel, groceries, gas, transit, entertainment, shopping, hotels, flights, other
CREATE TABLE IF NOT EXISTS card_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_name       TEXT NOT NULL,           -- e.g. "Amex Gold"
    card_network    TEXT,                    -- visa | mastercard | amex | discover
    last_four       TEXT,                    -- optional: "4242"
    color           TEXT DEFAULT '#183a37',  -- user-chosen card color for UI
    category_rates  JSONB NOT NULL DEFAULT '{}',
    -- e.g. { "dining": 4.0, "groceries": 4.0, "travel": 3.0, "other": 1.0 }
    is_default      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_profiles_user_id ON card_profiles(user_id);

-- Only one default card per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_card_profiles_default
    ON card_profiles(user_id) WHERE is_default = TRUE;


-- Trip budgets — per-category budget targets for a trip
CREATE TABLE IF NOT EXISTS trip_budgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    category        TEXT NOT NULL,   -- matches expense category names
    amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency        TEXT DEFAULT 'USD',
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (trip_id, category)
);

CREATE INDEX IF NOT EXISTS idx_trip_budgets_trip_id ON trip_budgets(trip_id);


-- Seed common card presets (users can clone these instead of entering rates manually)
-- These are stored as a static reference table, not tied to any user
CREATE TABLE IF NOT EXISTS card_presets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_name       TEXT NOT NULL,
    card_network    TEXT,
    issuer          TEXT,           -- Chase, Amex, Citi, etc.
    category_rates  JSONB NOT NULL DEFAULT '{}',
    travel_perks    TEXT[],         -- e.g. '{"Priority Pass","No foreign transaction fees"}'
    annual_fee      INTEGER DEFAULT 0
);

-- Common US travel cards
INSERT INTO card_presets (card_name, card_network, issuer, category_rates, travel_perks, annual_fee) VALUES
('Chase Sapphire Preferred', 'visa', 'Chase',
    '{"dining":3.0,"travel":2.0,"hotels":2.0,"flights":2.0,"transit":2.0,"streaming":3.0,"other":1.0}',
    ARRAY['Trip cancellation insurance','Primary car rental insurance','No foreign transaction fees'], 95),

('Chase Sapphire Reserve', 'visa', 'Chase',
    '{"dining":3.0,"travel":3.0,"hotels":3.0,"flights":3.0,"transit":3.0,"other":1.0}',
    ARRAY['Priority Pass','$300 annual travel credit','Trip delay insurance','No foreign transaction fees'], 550),

('Amex Gold', 'amex', 'American Express',
    '{"dining":4.0,"groceries":4.0,"flights":3.0,"hotels":1.0,"travel":1.0,"other":1.0}',
    ARRAY['$120 dining credit','$120 Uber Cash','No foreign transaction fees'], 250),

('Amex Platinum', 'amex', 'American Express',
    '{"flights":5.0,"hotels":5.0,"dining":1.0,"other":1.0}',
    ARRAY['Priority Pass','Centurion Lounge','$200 hotel credit','$200 airline fee credit','No foreign transaction fees'], 695),

('Capital One Venture', 'visa', 'Capital One',
    '{"hotels":5.0,"rental_cars":5.0,"dining":2.0,"travel":2.0,"other":2.0}',
    ARRAY['No foreign transaction fees','Global Entry/TSA PreCheck credit'], 95),

('Chase Freedom Unlimited', 'visa', 'Chase',
    '{"dining":3.0,"drugstores":3.0,"travel":5.0,"other":1.5}',
    ARRAY['No annual fee'], 0),

('Citi Double Cash', 'mastercard', 'Citi',
    '{"other":2.0,"dining":2.0,"travel":2.0,"groceries":2.0,"gas":2.0,"entertainment":2.0}',
    ARRAY['No annual fee'], 0),

('Discover it Cash Back', 'discover', 'Discover',
    '{"rotating":5.0,"other":1.0}',
    ARRAY['No annual fee','5% rotating categories (gas, groceries, restaurants, Amazon)'], 0),

('Chase Freedom Flex', 'visa', 'Chase',
    '{"rotating":5.0,"dining":3.0,"drugstores":3.0,"other":1.0}',
    ARRAY['No annual fee','5% rotating categories'], 0);
