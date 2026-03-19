-- Add logo_url column to farms table for PDF letterhead
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS logo_url text;
