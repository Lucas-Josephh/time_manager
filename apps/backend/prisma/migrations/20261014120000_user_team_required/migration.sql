-- Réaffecter les utilisateurs sans équipe avant d'appliquer cette migration.
DO $$
BEGIN
  LOCK TABLE "user" IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM "user" WHERE "teamId" IS NULL) THEN
    RAISE EXCEPTION 'Des utilisateurs sont sans équipe. Renseignez leur teamId avant de relancer la migration.';
  END IF;

  ALTER TABLE "user" DROP CONSTRAINT "user_teamId_fkey";
  ALTER TABLE "user" ALTER COLUMN "teamId" SET NOT NULL;
  ALTER TABLE "user" ADD CONSTRAINT "user_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END $$;
