-- Migration 013: Add 'amadeus' as a valid booking source
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_source_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_source_check
  CHECK (source = ANY (ARRAY[
    'booking.com'::text,
    'duffel'::text,
    'viator'::text,
    'rome2rio'::text,
    'manual'::text,
    'amadeus'::text
  ]));
