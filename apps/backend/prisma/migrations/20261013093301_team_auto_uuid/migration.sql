/*
  Warnings:

  - Made the column `managerId` on table `team` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "team" ALTER COLUMN "managerId" SET NOT NULL;
