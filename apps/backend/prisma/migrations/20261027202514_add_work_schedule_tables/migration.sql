-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "work_schedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedule_version" (
    "id" TEXT NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedule_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_day" (
    "id" TEXT NOT NULL,
    "workScheduleVersionId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,

    CONSTRAINT "schedule_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_slot" (
    "id" TEXT NOT NULL,
    "scheduleDayId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "time_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workScheduleVersionId" TEXT NOT NULL,

    CONSTRAINT "work_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_version_workScheduleId_key" ON "work_schedule_version"("workScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_day_workScheduleVersionId_dayOfWeek_key" ON "schedule_day"("workScheduleVersionId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "time_slot_scheduleDayId_idx" ON "time_slot"("scheduleDayId");

-- CreateIndex
CREATE INDEX "work_session_userId_startedAt_idx" ON "work_session"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "work_schedule_version" ADD CONSTRAINT "work_schedule_version_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "work_schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_day" ADD CONSTRAINT "schedule_day_workScheduleVersionId_fkey" FOREIGN KEY ("workScheduleVersionId") REFERENCES "work_schedule_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slot" ADD CONSTRAINT "time_slot_scheduleDayId_fkey" FOREIGN KEY ("scheduleDayId") REFERENCES "schedule_day"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_session" ADD CONSTRAINT "work_session_workScheduleVersionId_fkey" FOREIGN KEY ("workScheduleVersionId") REFERENCES "work_schedule_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_session" ADD CONSTRAINT "work_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
