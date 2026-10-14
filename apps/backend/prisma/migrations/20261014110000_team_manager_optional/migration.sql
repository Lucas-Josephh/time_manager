-- Permet de créer une équipe avant de lui affecter un responsable.
ALTER TABLE "team" ALTER COLUMN "managerId" DROP NOT NULL;
