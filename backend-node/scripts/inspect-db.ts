import { prisma } from '../src/lib/prisma';

async function main() {
  const bugReportCols = await prisma.$queryRaw<any[]>`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'bug_reports'
    ORDER BY ordinal_position;
  `;
  console.log('Columns in bug_reports:');
  console.table(bugReportCols);

  const pmCols = await prisma.$queryRaw<any[]>`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'project_members'
    ORDER BY ordinal_position;
  `;
  console.log('Columns in project_members:');
  console.table(pmCols);

  const tables = await prisma.$queryRaw<any[]>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
  `;
  console.log('Tables:', tables.map(t => t.table_name));
}

main().catch(console.error).finally(() => prisma.$disconnect());
