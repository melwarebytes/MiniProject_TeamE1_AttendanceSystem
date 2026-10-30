-- DropIndex
DROP INDEX "sections_courseId_name_key";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "anonymizedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sections" ALTER COLUMN "qrWindowMinutes" SET DEFAULT 5;

-- CreateTable
CREATE TABLE "enrollment_periods" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "enrollment_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL DEFAULT 'institution',
    "attendanceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "editWindowHours" INTEGER NOT NULL DEFAULT 48,
    "qrWindowMinutes" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enrollment_periods_enrollmentId_startsAt_idx" ON "enrollment_periods"("enrollmentId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "sections_courseId_name_semesterStart_key" ON "sections"("courseId", "name", "semesterStart");

-- CreateIndex
CREATE INDEX "enrollments_userId_idx" ON "enrollments"("userId");

-- CreateIndex
CREATE INDEX "sessions_sectionId_date_idx" ON "sessions"("sectionId", "date");

-- CreateIndex
CREATE INDEX "attendance_records_sessionId_idx" ON "attendance_records"("sessionId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_actorId_idx" ON "audit_logs"("createdAt", "actorId");

-- AddForeignKey
ALTER TABLE "enrollment_periods" ADD CONSTRAINT "enrollment_periods_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Legacy rosters cover the semester; future changes use dated membership periods.
INSERT INTO enrollment_periods (id, "enrollmentId", "startsAt")
SELECT 'legacy-' || e.id, e.id, s."semesterStart" FROM enrollments e JOIN sections s ON s.id=e."sectionId";
INSERT INTO policies (id, "attendanceThreshold", "editWindowHours", "qrWindowMinutes", "updatedAt")
VALUES ('institution',75,48,5,CURRENT_TIMESTAMP);
UPDATE sections SET "qrWindowMinutes"=5 WHERE "qrWindowMinutes" NOT BETWEEN 1 AND 10;
ALTER TABLE sections ADD CONSTRAINT section_policy_bounds CHECK
("attendanceThreshold" BETWEEN 50 AND 100 AND "editWindowHours" BETWEEN 0 AND 168 AND "qrWindowMinutes" BETWEEN 1 AND 10);
ALTER TABLE policies ADD CONSTRAINT policy_bounds CHECK
("attendanceThreshold" BETWEEN 50 AND 100 AND "editWindowHours" BETWEEN 0 AND 168 AND "qrWindowMinutes" BETWEEN 1 AND 10);

-- SADS 8.2: missing held marks count absent; cancelled and future classes are excluded.
CREATE VIEW attendance_percentages AS
SELECT e.id AS "enrollmentId", e."userId", e."sectionId",
 COUNT(s.id)::integer AS held,
 COUNT(s.id) FILTER (WHERE a.status IN ('PRESENT','LATE','EXCUSED'))::integer AS attended,
 CASE WHEN COUNT(s.id)=0 THEN 100.0 ELSE ROUND(
  100.0 * COUNT(s.id) FILTER (WHERE a.status IN ('PRESENT','LATE','EXCUSED')) / COUNT(s.id), 1) END AS percentage
FROM enrollments e JOIN sections sec ON sec.id=e."sectionId"
LEFT JOIN sessions s ON s."sectionId"=e."sectionId" AND s.status <> 'CANCELLED'
 AND ((s.date::date + s."startTime"::time) AT TIME ZONE 'Asia/Kolkata') <= CURRENT_TIMESTAMP
 AND (NOT EXISTS (SELECT 1 FROM enrollment_periods p WHERE p."enrollmentId"=e.id)
      OR EXISTS (SELECT 1 FROM enrollment_periods p WHERE p."enrollmentId"=e.id
       AND p."startsAt" <= ((s.date::date + s."startTime"::time) AT TIME ZONE 'Asia/Kolkata')
       AND (p."endsAt" IS NULL OR p."endsAt" > ((s.date::date + s."startTime"::time) AT TIME ZONE 'Asia/Kolkata'))))
LEFT JOIN attendance_records a ON a."sessionId"=s.id AND a."enrollmentId"=e.id
GROUP BY e.id;
