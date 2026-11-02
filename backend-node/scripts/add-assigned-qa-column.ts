import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Adding assigned_qa_id column to bug_reports...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "bug_reports" ADD COLUMN IF NOT EXISTS "assigned_qa_id" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bug_reports_assigned_qa_id_fkey'
      ) THEN
        ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_assigned_qa_id_fkey" 
        FOREIGN KEY ("assigned_qa_id") REFERENCES "users"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "bug_reports_assigned_qa_id_idx" ON "bug_reports"("assigned_qa_id");
  `);

  console.log('Successfully added assigned_qa_id column to bug_reports table.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
