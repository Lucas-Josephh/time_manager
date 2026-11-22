/*
  Warnings:

  - Added the required column `createdByUserId` to the `work_schedule_version` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "work_schedule_version" ADD COLUMN     "createdByUserId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "work_schedule_version" ADD CONSTRAINT "work_schedule_version_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
