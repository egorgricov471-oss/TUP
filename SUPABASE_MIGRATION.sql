-- TUP: add greeting field used by admin approval and profile UI.
-- Safe to run more than once; does not delete or overwrite existing data.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS greeting text;
