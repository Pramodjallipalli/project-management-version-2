# Architectural & Implementation Plan: Intern-Scoped Cohort System (Cohort 1 & Cohort 2)

---

## 1. Which Exact Table Represents Interns
In this system, user identity is unified in the **`users`** table, and role assignments are stored in the **`user_roles`** join table linked to the **`roles`** table:
* An **intern** is any user record in `users` having an associated record in `user_roles` where `role.name = 'INTERN'`.
* Non-interns (e.g. `MANAGER`, `TECH_LEAD`, `SUPER_ADMIN`, `ADMIN`) also reside in `users` but have distinct role associations.

---

## 2. Which Exact Table / Column Should Receive `cohort_id`
The **`users`** table will receive the new column:
```sql
ALTER TABLE "users" ADD COLUMN "cohort_id" TEXT;
```
*(with a foreign key referencing `cohorts(id)` and a database index on `"users"("cohort_id")`).*

**No other tables** (`projects`, `work_items`, `roles`, `permissions`, `user_sessions`, `organizations`, etc.) will receive `cohort_id`.

---

## 3. Why That Location is Correct & Minimum-Footprint
1. **Single Source of Truth**:
   * The cohort concept is fundamentally an **intern cohort** attribute (`INTERN → COHORT`).
   * By placing `cohort_id` on the intern's `users` record, every intern-related entity can be cleanly and authoritatively derived without redundant columns:
     * **Interns in Cohort**: `users.filter(u => u.cohort_id === selectedCohortId && u.roles.includes('INTERN'))`
     * **Tasks / Work Items in Cohort**: Work items assigned to interns via `work_item_assignees -> user -> cohort_id`.
     * **Timesheets / Attendance in Cohort**: `time_entries` and `work_sessions` belong directly to `user_id`, meaning attendance and hours are naturally scoped by the intern's `cohort_id`.
2. **Prevents Conflicting States**:
   * If `cohort_id` were duplicated on `projects` and `work_items`, a project or task could become out-of-sync with its assignees (e.g. intern in Cohort 1 assigned to a task marked Cohort 2).
   * Keeping `cohort_id` exclusively on `users` eliminates data inconsistencies.
3. **Preserves Existing Data Integrity**:
   * Managers, Admins, and Tech Leads will have `cohort_id = NULL`.
   * The existing `batch` string field on `users` remains completely untouched.

---

## 4. The Proposed `cohorts` Table Schema
In `backend-node/prisma/schema.prisma`:
```prisma
model Cohort {
  id              String       @id @default(uuid())
  organization_id String
  name            String       // e.g., "Cohort 1", "Cohort 2"
  code            String       // e.g., "cohort-1", "cohort-2"
  description     String?
  start_date      DateTime?
  end_date        DateTime?
  is_active       Boolean      @default(true)
  created_at      DateTime     @default(now())
  updated_at      DateTime     @updatedAt

  organization    Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  users           User[]

  @@unique([organization_id, code])
  @@index([organization_id])
  @@map("cohorts")
}
```

In `model User`:
```prisma
model User {
  ...
  cohort_id       String?
  cohort          Cohort?      @relation(fields: [cohort_id], references: [id], onDelete: SetNull)
  ...
  @@index([cohort_id])
  @@map("users")
}
```

---

## 5. Exact Migration SQL
Generated non-destructive migration script (e.g., `backend-node/prisma/migrations/20261008103000_add_intern_cohorts/migration.sql`):

```sql
-- 1. Create the cohorts table
CREATE TABLE "cohorts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

-- 2. Add unique constraint and indexes on cohorts
CREATE UNIQUE INDEX "cohorts_organization_id_code_key" ON "cohorts"("organization_id", "code");
CREATE INDEX "cohorts_organization_id_idx" ON "cohorts"("organization_id");

-- 3. Add foreign key from cohorts to organizations
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Add nullable cohort_id column to users
ALTER TABLE "users" ADD COLUMN "cohort_id" TEXT;

-- 5. Add index on users(cohort_id)
CREATE INDEX "users_cohort_id_idx" ON "users"("cohort_id");

-- 6. Add foreign key from users to cohorts
ALTER TABLE "users" ADD CONSTRAINT "users_cohort_id_fkey" 
    FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## 6. Exact Cohort-1 Backfill Logic & Cohort 2 Initialization
Run immediately post-migration:

```sql
-- Step A: Insert Cohort 1 and Cohort 2 for each organization
INSERT INTO "cohorts" ("id", "organization_id", "name", "code", "description", "is_active", "created_at", "updated_at")
SELECT 
    gen_random_uuid()::text,
    o.id,
    'Cohort 1',
    'cohort-1',
    'Initial intern cohort',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" o
WHERE NOT EXISTS (
    SELECT 1 FROM "cohorts" c WHERE c.organization_id = o.id AND c.code = 'cohort-1'
);

INSERT INTO "cohorts" ("id", "organization_id", "name", "code", "description", "is_active", "created_at", "updated_at")
SELECT 
    gen_random_uuid()::text,
    o.id,
    'Cohort 2',
    'cohort-2',
    'Upcoming future cohort',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" o
WHERE NOT EXISTS (
    SELECT 1 FROM "cohorts" c WHERE c.organization_id = o.id AND c.code = 'cohort-2'
);

-- Step B: Backfill ONLY users who hold the INTERN role to Cohort 1
UPDATE "users" u
SET "cohort_id" = (
    SELECT c.id 
    FROM "cohorts" c 
    WHERE c.organization_id = u.organization_id AND c.code = 'cohort-1'
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 
    FROM "user_roles" ur
    JOIN "roles" r ON r.id = ur.role_id
    WHERE ur.user_id = u.id AND r.name = 'INTERN'
)
AND u.cohort_id IS NULL;
```

---

## 7. How Cohort 2 Will Remain Empty
* **No intern records** will have `cohort_id = (Cohort 2 ID)`.
* Non-interns (`MANAGER`, `ADMIN`, `TECH_LEAD`) remain with `cohort_id = NULL`.
* No tasks, timesheets, or user records are copied, cloned, or linked to Cohort 2.
* Cohort 2 exists strictly as a record in `cohorts`.

---

## 8. Backend Changes
1. **New Route**: `GET /api/cohorts`
   * Middleware: `authenticate`
   * Scoped to `req.user.organization_id`
   * Returns active cohorts sorted by `name ASC` (`Cohort 1`, `Cohort 2`).
2. **User Controller & Service (`GET /api/users`)**:
   * Accepts optional `cohort_id` query parameter.
   * When `cohort_id` is passed, filters interns by:
     ```typescript
     if (cohortId) {
       where.cohort_id = cohortId;
     }
     ```
3. **Timesheet / Manager Reporting (`GET /api/timesheet/manager-report`)**:
   * Accepts optional `cohort_id` parameter to scope aggregated attendance/task statistics to interns belonging to that cohort.

---

## 9. Frontend Changes

### A. Navigation Header Dropdown (`Header.jsx`)
* Render a Cohort Selector directly to the right of the search bar:
  ```
  [ Search tasks, interns...      ] [ Cohort 1 ▾ ] [ ✉ ] [ 🔔 ] | Date
  ```
* Features:
  * Dynamic list fetched from `GET /api/cohorts`.
  * Only displays actual cohorts (`Cohort 1`, `Cohort 2` — **NO "All Cohorts"** option).
  * Persists selected cohort state in `localStorage` (`selected_cohort_id`), defaulting to Cohort 1.

### B. Manager Dashboard (`ManagerDashboardView.jsx`)
* **When Cohort 1 is selected**:
  * Operates identically to the current dashboard, scoped to Cohort 1 interns.
  * All active metrics, project health, deadlines, and intern statuses render normally.
* **When Cohort 2 is selected**:
  * Instead of rendering misleading zero-filled graphs, renders a clean, professional future-cohort state card:
    * Badge: `COHORT 2 • UPCOMING COHORT`
    * Heading: `No Intern Data Added Yet`
    * Description: `Cohort 2 has been initialized for your organization. Intern assignments, tasks, and attendance tracking will activate as soon as interns are enrolled into Cohort 2.`
    * Action button: Quick link to provision/import interns into Cohort 2.

---

## 10. Security & Supabase RLS Impact
* **RLS (Row Level Security)**:
  * In the existing database, tables have `relrowsecurity = true` while backend queries run with the direct PostgreSQL database connection (`DATABASE_URL`).
  * If RLS policies are enabled on `cohorts`, standard tenant isolation applies:
    ```sql
    ALTER TABLE "cohorts" ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Organizations isolate cohorts" ON "cohorts"
        FOR ALL USING (organization_id = auth.jwt() ->> 'organization_id');
    ```
* **Backend Authorization**:
  * Cohort filtering is treated strictly as a **data filter**, never as an authentication bypass.
  * Queries always enforce `organization_id = req.user.organization_id`. A manager from Org A cannot query cohorts or interns from Org B regardless of what `cohort_id` is supplied in the request.

---

## 11. Validation Queries (Post-Migration Verification)
Before declaring completion, run:
```sql
-- 1. Verify Cohort 1 and Cohort 2 exist
SELECT id, organization_id, name, code FROM "cohorts";

-- 2. Verify all interns are assigned to Cohort 1
SELECT u.id, u.email, u.name, r.name as role, c.name as cohort
FROM "users" u
JOIN "user_roles" ur ON ur.user_id = u.id
JOIN "roles" r ON r.id = ur.role_id
LEFT JOIN "cohorts" c ON c.id = u.cohort_id
WHERE r.name = 'INTERN';

-- 3. Verify zero non-interns are assigned to any cohort
SELECT u.id, u.email, r.name as role, u.cohort_id
FROM "users" u
JOIN "user_roles" ur ON ur.user_id = u.id
JOIN "roles" r ON r.id = ur.role_id
WHERE r.name != 'INTERN' AND u.cohort_id IS NOT NULL;
-- (Expected result: 0 rows)

-- 4. Verify Cohort 2 contains zero intern records
SELECT count(*) 
FROM "users" u 
JOIN "cohorts" c ON c.id = u.cohort_id 
WHERE c.code = 'cohort-2';
-- (Expected result: 0)
```

---

## 12. Rollback Strategy
If rollback is ever required:
```sql
-- 1. Remove foreign key and column from users
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_cohort_id_fkey";
DROP INDEX IF EXISTS "users_cohort_id_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "cohort_id";

-- 2. Drop cohorts table
DROP TABLE IF EXISTS "cohorts";
```
* Existing `users.batch` and all business records (`projects`, `work_items`, `time_entries`) remain completely intact and unaffected.

---

*(Execution is paused pending your explicit review and approval.)*
