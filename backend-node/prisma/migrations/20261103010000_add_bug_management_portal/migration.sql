CREATE TYPE "BugSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "BugPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "BugReportStatus" AS ENUM ('PENDING_REVIEW', 'NEED_INFO', 'VERIFIED', 'REJECTED', 'DUPLICATE');
CREATE TYPE "BugReviewOutcome" AS ENUM ('VERIFIED', 'INFO_REQUESTED', 'REJECTED', 'DUPLICATE');
CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'FIXED', 'READY_FOR_RETEST', 'CLOSED', 'REOPENED');
CREATE TYPE "BugRetestResult" AS ENUM ('PASS', 'FAIL');

CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "steps_to_reproduce" TEXT NOT NULL,
    "expected_result" TEXT NOT NULL,
    "actual_result" TEXT NOT NULL,
    "environment" TEXT,
    "severity" "BugSeverity" NOT NULL DEFAULT 'MEDIUM',
    "assigned_qa_id" TEXT,
    "status" "BugReportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bugs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "origin_report_id" TEXT,
    "bug_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "BugSeverity" NOT NULL DEFAULT 'MEDIUM',
    "priority" "BugPriority" NOT NULL DEFAULT 'MEDIUM',
    "current_assignee_id" TEXT,
    "triage_notes" TEXT,
    "resolution_summary" TEXT,
    "fixed_in_build" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bugs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bug_reviews" (
    "id" TEXT NOT NULL,
    "bug_report_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "outcome" "BugReviewOutcome" NOT NULL,
    "notes" TEXT NOT NULL,
    "duplicate_of_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bug_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bug_assignments" (
    "id" TEXT NOT NULL,
    "bug_id" TEXT NOT NULL,
    "assignee_id" TEXT NOT NULL,
    "assigned_by_id" TEXT NOT NULL,
    "notes" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bug_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bug_retests" (
    "id" TEXT NOT NULL,
    "bug_id" TEXT NOT NULL,
    "retester_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "tested_build" TEXT NOT NULL,
    "result" "BugRetestResult" NOT NULL,
    "notes" TEXT NOT NULL,
    "status_before" "BugStatus" NOT NULL,
    "status_after" "BugStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bug_retests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bug_comments" (
    "id" TEXT NOT NULL,
    "bug_id" TEXT,
    "bug_report_id" TEXT,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bug_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bug_attachments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "bug_report_id" TEXT,
    "bug_id" TEXT,
    "retest_id" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "sanitized_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bug_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bug_events" (
    "id" TEXT NOT NULL,
    "bug_id" TEXT,
    "bug_report_id" TEXT,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bug_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bugs_origin_report_id_key" ON "bugs"("origin_report_id");
CREATE UNIQUE INDEX "bugs_project_id_bug_code_key" ON "bugs"("project_id", "bug_code");
CREATE INDEX "bug_reports_project_id_idx" ON "bug_reports"("project_id");
CREATE INDEX "bug_reports_reporter_id_idx" ON "bug_reports"("reporter_id");
CREATE INDEX "bug_reports_assigned_qa_id_idx" ON "bug_reports"("assigned_qa_id");
CREATE INDEX "bug_reports_status_idx" ON "bug_reports"("status");
CREATE INDEX "bug_reviews_bug_report_id_idx" ON "bug_reviews"("bug_report_id");
CREATE INDEX "bug_reviews_reviewer_id_idx" ON "bug_reviews"("reviewer_id");
CREATE INDEX "bugs_project_id_idx" ON "bugs"("project_id");
CREATE INDEX "bugs_status_idx" ON "bugs"("status");
CREATE INDEX "bugs_current_assignee_id_idx" ON "bugs"("current_assignee_id");
CREATE INDEX "bug_assignments_bug_id_idx" ON "bug_assignments"("bug_id");
CREATE INDEX "bug_assignments_assignee_id_idx" ON "bug_assignments"("assignee_id");
CREATE INDEX "bug_retests_bug_id_idx" ON "bug_retests"("bug_id");
CREATE INDEX "bug_retests_retester_id_idx" ON "bug_retests"("retester_id");
CREATE INDEX "bug_comments_bug_id_idx" ON "bug_comments"("bug_id");
CREATE INDEX "bug_comments_bug_report_id_idx" ON "bug_comments"("bug_report_id");
CREATE INDEX "bug_comments_author_id_idx" ON "bug_comments"("author_id");
CREATE INDEX "bug_attachments_project_id_idx" ON "bug_attachments"("project_id");
CREATE INDEX "bug_attachments_bug_report_id_idx" ON "bug_attachments"("bug_report_id");
CREATE INDEX "bug_attachments_bug_id_idx" ON "bug_attachments"("bug_id");
CREATE INDEX "bug_attachments_retest_id_idx" ON "bug_attachments"("retest_id");
CREATE INDEX "bug_events_bug_id_idx" ON "bug_events"("bug_id");
CREATE INDEX "bug_events_bug_report_id_idx" ON "bug_events"("bug_report_id");
CREATE INDEX "bug_events_actor_id_idx" ON "bug_events"("actor_id");

ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_reporter_id_fkey"
    FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_assigned_qa_id_fkey"
    FOREIGN KEY ("assigned_qa_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_origin_report_id_fkey"
    FOREIGN KEY ("origin_report_id") REFERENCES "bug_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_current_assignee_id_fkey"
    FOREIGN KEY ("current_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bug_reviews" ADD CONSTRAINT "bug_reviews_bug_report_id_fkey"
    FOREIGN KEY ("bug_report_id") REFERENCES "bug_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_reviews" ADD CONSTRAINT "bug_reviews_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_reviews" ADD CONSTRAINT "bug_reviews_duplicate_of_id_fkey"
    FOREIGN KEY ("duplicate_of_id") REFERENCES "bugs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bug_assignments" ADD CONSTRAINT "bug_assignments_bug_id_fkey"
    FOREIGN KEY ("bug_id") REFERENCES "bugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_assignments" ADD CONSTRAINT "bug_assignments_assignee_id_fkey"
    FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_assignments" ADD CONSTRAINT "bug_assignments_assigned_by_id_fkey"
    FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_retests" ADD CONSTRAINT "bug_retests_bug_id_fkey"
    FOREIGN KEY ("bug_id") REFERENCES "bugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_retests" ADD CONSTRAINT "bug_retests_retester_id_fkey"
    FOREIGN KEY ("retester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_comments" ADD CONSTRAINT "bug_comments_bug_id_fkey"
    FOREIGN KEY ("bug_id") REFERENCES "bugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_comments" ADD CONSTRAINT "bug_comments_bug_report_id_fkey"
    FOREIGN KEY ("bug_report_id") REFERENCES "bug_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_comments" ADD CONSTRAINT "bug_comments_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_attachments" ADD CONSTRAINT "bug_attachments_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_attachments" ADD CONSTRAINT "bug_attachments_bug_report_id_fkey"
    FOREIGN KEY ("bug_report_id") REFERENCES "bug_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_attachments" ADD CONSTRAINT "bug_attachments_bug_id_fkey"
    FOREIGN KEY ("bug_id") REFERENCES "bugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_attachments" ADD CONSTRAINT "bug_attachments_retest_id_fkey"
    FOREIGN KEY ("retest_id") REFERENCES "bug_retests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_attachments" ADD CONSTRAINT "bug_attachments_uploaded_by_fkey"
    FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_events" ADD CONSTRAINT "bug_events_bug_id_fkey"
    FOREIGN KEY ("bug_id") REFERENCES "bugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_events" ADD CONSTRAINT "bug_events_bug_report_id_fkey"
    FOREIGN KEY ("bug_report_id") REFERENCES "bug_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_events" ADD CONSTRAINT "bug_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
