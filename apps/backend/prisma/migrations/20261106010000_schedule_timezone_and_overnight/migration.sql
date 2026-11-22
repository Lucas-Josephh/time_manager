-- Existing schedules are interpreted in Europe/Paris. Adjust before deployment
-- if existing data was authored in another time zone.
ALTER TABLE "work_schedule" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris';
ALTER TABLE "time_slot" ADD COLUMN "endsNextDay" BOOLEAN NOT NULL DEFAULT false;

-- Prisma previously stored instants in a timestamp column as UTC.
ALTER TABLE "user_work_schedule_assignment"
  ALTER COLUMN "effectiveFrom" TYPE TIMESTAMPTZ(3)
  USING "effectiveFrom" AT TIME ZONE 'UTC';
