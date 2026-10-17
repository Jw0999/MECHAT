-- Add description column to conversations for group details
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS description TEXT;
