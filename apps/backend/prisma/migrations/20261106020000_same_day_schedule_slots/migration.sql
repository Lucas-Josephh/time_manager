BEGIN;
-- Do not silently reinterpret overnight slots created before this restriction.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM time_slot WHERE "endsNextDay" = true) THEN
    RAISE EXCEPTION 'Resolve overnight time slots before removing endsNextDay';
  END IF;
END $$;
ALTER TABLE "time_slot" DROP COLUMN "endsNextDay";
COMMIT;
