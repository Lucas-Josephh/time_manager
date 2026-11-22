-- CreateTable
CREATE TABLE "user_work_schedule_assignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_work_schedule_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_work_schedule_assignment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_work_schedule_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_work_schedule_assignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_work_schedule_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_work_schedule_assignment_userId_effectiveFrom_key" ON "user_work_schedule_assignment"("userId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "team_work_schedule_assignment_teamId_effectiveFrom_key" ON "team_work_schedule_assignment"("teamId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "organization_work_schedule_assignment_organizationId_effect_key" ON "organization_work_schedule_assignment"("organizationId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "user_work_schedule_assignment" ADD CONSTRAINT "user_work_schedule_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_work_schedule_assignment" ADD CONSTRAINT "user_work_schedule_assignment_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "work_schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_work_schedule_assignment" ADD CONSTRAINT "team_work_schedule_assignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_work_schedule_assignment" ADD CONSTRAINT "team_work_schedule_assignment_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "work_schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_work_schedule_assignment" ADD CONSTRAINT "organization_work_schedule_assignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_work_schedule_assignment" ADD CONSTRAINT "organization_work_schedule_assignment_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "work_schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
