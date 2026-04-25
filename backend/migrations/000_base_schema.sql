-- ============================================================
-- 000_base_schema.sql
-- Run this FIRST in Supabase SQL Editor before all other migrations.
-- Creates the foundational tables the rest of the migrations depend on.
-- All statements use IF NOT EXISTS so it is safe to re-run.
-- ============================================================

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    username        TEXT NOT NULL UNIQUE,
    password        TEXT NOT NULL,
    street          TEXT,
    city            TEXT,
    state           TEXT,
    zip_code        TEXT,
    profile_picture TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Trips (aka Groups) ────────────────────────────────────────────────────────
-- The app calls this "groups" in the UI but the table is "trips".
-- Migrations 021/022 incorrectly referenced groups(id) — this is the real table.
CREATE TABLE IF NOT EXISTS public.trips (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    owner_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    group_id    UUID,           -- legacy FK field used by booking.py; nullable
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trips_owner_id ON public.trips(owner_id);

-- ── Conversations (Group Chat) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversation (
    conversation_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_name TEXT NOT NULL DEFAULT 'Group Chat',
    trip_id           UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_trip_id ON public.conversation(trip_id);

-- ── Group Members (Chat Membership) ──────────────────────────────────────────
-- Tracks which users belong to which conversation/trip.
-- group_id links to trips.id; conversation_id links to the chat conversation.
CREATE TABLE IF NOT EXISTS public.group_member (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversation(conversation_id) ON DELETE CASCADE,
    group_id        UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL DEFAULT 'member',
    join_datetime   TIMESTAMPTZ DEFAULT now(),
    left_datetime   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_group_member_group_user_active
    ON public.group_member(group_id, user_id)
    WHERE left_datetime IS NULL;

CREATE INDEX IF NOT EXISTS idx_group_member_conversation_user
    ON public.group_member(conversation_id, user_id)
    WHERE left_datetime IS NULL;

-- ── Messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    sent_datetime   TIMESTAMPTZ NOT NULL DEFAULT now(),
    conversation_id UUID NOT NULL REFERENCES public.conversation(conversation_id) ON DELETE CASCADE,
    is_encrypted    BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_message_conversation_sent
    ON public.message(conversation_id, sent_datetime DESC);

-- ── Encrypted Chat Session Keys ───────────────────────────────────────────────
-- Stores per-user encrypted copies of the group session key (NaCl).
CREATE TABLE IF NOT EXISTS public.conversation_session_key (
    conversation_id UUID NOT NULL REFERENCES public.conversation(conversation_id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    encrypted_key   TEXT NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

-- ── User Preferences ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    preferred_categories  TEXT[] DEFAULT '{}',
    price_preference      TEXT DEFAULT 'moderate',
    dietary_restrictions  TEXT[] DEFAULT '{}',
    interests             TEXT[] DEFAULT '{}',
    avoid_types           TEXT[] DEFAULT '{}'
);

-- ── Saved Routes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_routes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    waypoints       JSONB NOT NULL DEFAULT '[]',
    route_data      JSONB NOT NULL DEFAULT '{}',
    total_distance  DOUBLE PRECISION,
    total_duration  DOUBLE PRECISION,
    created_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_routes_trip_id     ON public.saved_routes(trip_id);
CREATE INDEX IF NOT EXISTS idx_saved_routes_created_by  ON public.saved_routes(created_by);

-- ── Bookings (from booking_repository / bookings search service) ───────────────
CREATE TABLE IF NOT EXISTS public.bookings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,  -- hotel | flight | car | activity | other
    title           TEXT NOT NULL,
    vendor          TEXT,
    source          TEXT DEFAULT 'manual' CHECK (source = ANY (ARRAY[
                        'booking.com', 'duffel', 'viator', 'rome2rio', 'manual', 'amadeus', 'google_flights'
                    ])),
    external_id     TEXT,
    external_ref    TEXT,
    booking_url     TEXT,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    price           NUMERIC(12,2),
    currency        TEXT DEFAULT 'USD',
    details         JSONB DEFAULT '{}',
    status          TEXT DEFAULT 'active' CHECK (status = ANY (ARRAY['active','cancelled'])),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON public.bookings(trip_id);

-- ── Booking Participants ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_participants (
    booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    PRIMARY KEY (booking_id, user_id)
);

-- ── Booking (singular — used by the simpler booking.py router) ─────────────────
CREATE TABLE IF NOT EXISTS public.booking (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id             UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    vendor              TEXT,
    type                TEXT DEFAULT 'other',
    start_time          TEXT,
    end_time            TEXT,
    confirmation_code   TEXT,
    cost                NUMERIC(12,2),
    currency            TEXT DEFAULT 'USD',
    notes               TEXT,
    created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status              TEXT DEFAULT 'active',
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_trip_id ON public.booking(trip_id);
