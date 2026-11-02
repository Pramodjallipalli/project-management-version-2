import { prisma } from '../src/lib/prisma';

async function main() {
  const [globalRoles, projectRoleCounts] = await Promise.all([
    prisma.role.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.projectMemberRole.groupBy({
      by: ['role_name'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
  ]);

  console.log('Global Roles:', globalRoles);
  console.log('Project Role Distribution:', projectRoleCounts);
}

main().finally(() => prisma.$disconnect());
