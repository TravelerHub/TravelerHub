-- Migration 023: Add google_flights as a valid flight booking source.
-- Amadeus self-service API is shutting down (July 2026).
-- Flight search now uses fast-flights (no API key required).
-- Safe to run on any DB that already ran 013_booking_source_amadeus.sql.

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_source_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_source_check
  CHECK (source = ANY (ARRAY[
    'booking.com'::text,
    'duffel'::text,
    'viator'::text,
    'rome2rio'::text,
    'manual'::text,
    'amadeus'::text,
    'google_flights'::text
  ]));
