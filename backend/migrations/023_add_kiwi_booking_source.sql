-- Migration 023: Add SerpApi as a valid flight booking source.
-- Amadeus self-service API is shutting down (July 2026); SerpApi replaces it.
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
    'serpapi'::text
  ]));
