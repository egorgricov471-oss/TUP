-- Додаткові поля для нового дизайну та типів пам'ятних дат.
-- Існуючі записи та старе поле is_death зберігаються.
ALTER TABLE public.dates
  ADD COLUMN IF NOT EXISTS date_type text;

UPDATE public.dates
SET date_type = CASE WHEN is_death THEN 'death' ELSE 'birthday' END
WHERE date_type IS NULL;

ALTER TABLE public.dates
  ALTER COLUMN date_type SET DEFAULT 'birthday';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dates_date_type_check'
      AND conrelid = 'public.dates'::regclass
  ) THEN
    ALTER TABLE public.dates
      ADD CONSTRAINT dates_date_type_check
      CHECK (date_type IN ('birthday', 'death', 'event'));
  END IF;
END $$;
