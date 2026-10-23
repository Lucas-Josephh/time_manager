/*
  Warnings:

  - You are about to drop the column `departmentId` on the `team` table. All the data in the column will be lost.
  - You are about to drop the `department` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `organizationId` to the `team` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "team" DROP CONSTRAINT "team_departmentId_fkey";

-- DropIndex
DROP INDEX "team_departmentId_idx";

-- AlterTable
ALTER TABLE "team" DROP COLUMN "departmentId",
ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "organizationId" TEXT;

-- DropTable
DROP TABLE "department";

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,
    "managerId" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_parentId_idx" ON "organization"("parentId");

-- CreateIndex
CREATE INDEX "organization_managerId_idx" ON "organization"("managerId");

-- CreateIndex
CREATE INDEX "team_organizationId_idx" ON "team"("organizationId");

-- CreateIndex
CREATE INDEX "team_managerId_idx" ON "team"("managerId");

-- CreateIndex
CREATE INDEX "user_organizationId_idx" ON "user"("organizationId");

-- CreateIndex
CREATE INDEX "user_teamId_idx" ON "user"("teamId");

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
