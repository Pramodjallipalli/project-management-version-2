import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Creating project_member_roles table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "project_member_roles" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "project_id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "role_name" TEXT NOT NULL,
      "role_id" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "project_member_roles_project_id_user_id_fkey" FOREIGN KEY ("project_id", "user_id") REFERENCES "project_members"("project_id", "user_id") ON DELETE CASCADE,
      CONSTRAINT "project_member_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL,
      CONSTRAINT "project_member_roles_project_id_user_id_role_name_key" UNIQUE ("project_id", "user_id", "role_name")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "project_member_roles_project_id_user_id_idx" ON "project_member_roles"("project_id", "user_id");
  `);

  console.log('Migrating existing single-role project members into project_member_roles...');
  const migrated = await prisma.$executeRawUnsafe(`
    INSERT INTO "project_member_roles" ("id", "project_id", "user_id", "role_name", "role_id", "created_at")
    SELECT 
      gen_random_uuid()::text,
      "project_id",
      "user_id",
      UPPER(TRIM("project_role")),
      "role_id",
      NOW()
    FROM "project_members"
    WHERE "project_role" IS NOT NULL AND TRIM("project_role") != ''
    ON CONFLICT ("project_id", "user_id", "role_name") DO NOTHING;
  `);

  console.log('Migrated existing project member roles count:', migrated);
}

main().catch(console.error).finally(() => prisma.$disconnect());
