CREATE TABLE IF NOT EXISTS "project_member_roles" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_name" TEXT NOT NULL,
    "role_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_roles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_member_roles_project_id_user_id_role_name_key" UNIQUE ("project_id", "user_id", "role_name"),
    CONSTRAINT "project_member_roles_project_id_user_id_fkey"
        FOREIGN KEY ("project_id", "user_id")
        REFERENCES "project_members"("project_id", "user_id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_member_roles_role_id_fkey"
        FOREIGN KEY ("role_id")
        REFERENCES "roles"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_member_roles_project_id_user_id_idx"
    ON "project_member_roles"("project_id", "user_id");

INSERT INTO "project_member_roles" ("id", "project_id", "user_id", "role_name", "role_id", "created_at")
SELECT
    gen_random_uuid()::text,
    "project_id",
    "user_id",
    UPPER(TRIM("project_role")),
    "role_id",
    CURRENT_TIMESTAMP
FROM "project_members"
WHERE "project_role" IS NOT NULL AND TRIM("project_role") <> ''
ON CONFLICT ("project_id", "user_id", "role_name") DO NOTHING;
