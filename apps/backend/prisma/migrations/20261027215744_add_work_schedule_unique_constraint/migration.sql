/*
  Warnings:

  - A unique constraint covering the columns `[workScheduleId,version]` on the table `work_schedule_version` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "work_schedule_version_workScheduleId_key";

-- AlterTable
ALTER TABLE "work_schedule_version" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_version_workScheduleId_version_key" ON "work_schedule_version"("workScheduleId", "version");
