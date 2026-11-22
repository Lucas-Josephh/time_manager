CREATE UNIQUE INDEX "work_session_one_open_per_user_idx"
ON "work_session" ("userId")
WHERE "endedAt" IS NULL;
