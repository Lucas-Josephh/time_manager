BEGIN;
-- Collective assignments cannot be converted from current membership without
-- inventing history. Explicitly resolve these records before retrying migration.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM team_work_schedule_assignment)
     OR EXISTS (SELECT 1 FROM organization_work_schedule_assignment) THEN
    RAISE EXCEPTION 'Resolve collective schedule assignments into dated user assignments before migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM user_work_schedule_assignment a
    JOIN work_schedule_version v ON v."workScheduleId" = a."workScheduleId"
    GROUP BY a.id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'User assignments to multi-version schedules require explicit historical mapping before migration';
  END IF;
END $$;

ALTER TABLE work_schedule ADD COLUMN "sourceWorkScheduleId" TEXT;
CREATE TEMP TABLE schedule_conversion ON COMMIT DROP AS
SELECT v.*, CASE WHEN row_number() OVER w = 1 THEN v."workScheduleId"
                 ELSE gen_random_uuid()::text END AS "newId"
FROM work_schedule_version v
WINDOW w AS (PARTITION BY v."workScheduleId" ORDER BY v.version);

INSERT INTO work_schedule (id, name, "createdAt", "updatedAt", "createdByUserId")
SELECT c."newId", s.name, c."createdAt", c."updatedAt", c."createdByUserId"
FROM schedule_conversion c JOIN work_schedule s ON s.id = c."workScheduleId"
WHERE c."newId" <> c."workScheduleId";

WITH origins AS (
  SELECT "newId", lag("newId") OVER (PARTITION BY "workScheduleId" ORDER BY version) AS source
  FROM schedule_conversion
)
UPDATE work_schedule s SET "sourceWorkScheduleId" = o.source
FROM origins o WHERE s.id = o."newId";

ALTER TABLE schedule_day DROP CONSTRAINT "schedule_day_workScheduleVersionId_fkey";
DROP INDEX "schedule_day_workScheduleVersionId_dayOfWeek_key";
UPDATE schedule_day d SET "workScheduleVersionId" = c."newId"
FROM schedule_conversion c WHERE d."workScheduleVersionId" = c.id;
ALTER TABLE schedule_day RENAME COLUMN "workScheduleVersionId" TO "workScheduleId";
ALTER TABLE schedule_day ADD CONSTRAINT "schedule_day_workScheduleId_fkey"
  FOREIGN KEY ("workScheduleId") REFERENCES work_schedule(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "schedule_day_workScheduleId_dayOfWeek_key" ON schedule_day("workScheduleId", "dayOfWeek");

ALTER TABLE work_session DROP CONSTRAINT "work_session_workScheduleVersionId_fkey";
UPDATE work_session s SET "workScheduleVersionId" = c."newId"
FROM schedule_conversion c WHERE s."workScheduleVersionId" = c.id;
ALTER TABLE work_session RENAME COLUMN "workScheduleVersionId" TO "workScheduleId";
ALTER TABLE work_session ADD CONSTRAINT "work_session_workScheduleId_fkey"
  FOREIGN KEY ("workScheduleId") REFERENCES work_schedule(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE work_schedule ADD CONSTRAINT "work_schedule_sourceWorkScheduleId_fkey"
  FOREIGN KEY ("sourceWorkScheduleId") REFERENCES work_schedule(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "work_schedule_sourceWorkScheduleId_idx" ON work_schedule("sourceWorkScheduleId");
CREATE INDEX "user_work_schedule_assignment_workScheduleId_idx" ON user_work_schedule_assignment("workScheduleId");
DROP TABLE work_schedule_version;
DROP TABLE team_work_schedule_assignment;
DROP TABLE organization_work_schedule_assignment;
COMMIT;
