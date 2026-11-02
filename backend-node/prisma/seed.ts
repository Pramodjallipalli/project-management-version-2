import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { generateInternRecords } from '../scripts/seed-interns';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding roles and permissions...');

  // 1. Create Roles
  const roles = ['ADMIN', 'MANAGER', 'INTERN', 'TECH_LEAD', 'SUPER_ADMIN', 'EMPLOYEE', 'DEVELOPER', 'QA_TESTER'];
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  // 2. Create Permissions
  const permissions = [
    'USER_READ', 'USER_CREATE', 'USER_BULK_CREATE', 'USER_UPDATE', 'USER_DELETE',
    'PROJECT_READ', 'PROJECT_CREATE', 'PROJECT_UPDATE', 'PROJECT_DELETE',
    'TASK_READ', 'TASK_CREATE', 'TASK_UPDATE', 'TASK_DELETE', 'TASK_ASSIGN',
    'FORM_READ', 'FORM_CREATE', 'FORM_UPDATE', 'FORM_DELETE', 'FORM_SUBMIT',
    'ATTENDANCE_READ', 'ATTENDANCE_CREATE', 'ATTENDANCE_UPDATE',
    'EVALUATION_READ', 'EVALUATION_CREATE', 'EVALUATION_UPDATE',
    'ORGANIZATION_READ', 'ORGANIZATION_CREATE', 'ORGANIZATION_UPDATE', 'ORGANIZATION_DELETE',
    'DOCUMENT_UPLOAD',
    'NOTIFICATION_READ', 'NOTIFICATION_CREATE'
  ];

  for (const permName of permissions) {
    await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: { name: permName },
    });
  }

  // 3. Assign Permissions to Roles (Manager & Intern & Employee & Tech Lead)
  const managerRole = await prisma.role.findUnique({ where: { name: 'MANAGER' } });
  const internRole = await prisma.role.findUnique({ where: { name: 'INTERN' } });
  const employeeRole = await prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  const techLeadRole = await prisma.role.findUnique({ where: { name: 'TECH_LEAD' } });

  const superAdminPerms = [
    'ORGANIZATION_READ', 'ORGANIZATION_CREATE', 'ORGANIZATION_UPDATE', 'ORGANIZATION_DELETE',
    'USER_READ', 'USER_CREATE', 'USER_UPDATE', 'USER_DELETE',
    'PROJECT_READ', 'PROJECT_CREATE', 'PROJECT_UPDATE', 'PROJECT_DELETE'
  ];

  const managerPerms = [
    'USER_READ', 'USER_CREATE', 'USER_BULK_CREATE', 'USER_UPDATE', 'USER_DELETE',
    'PROJECT_READ', 'PROJECT_CREATE', 'PROJECT_UPDATE', 'PROJECT_DELETE',
    'TASK_READ', 'TASK_CREATE', 'TASK_UPDATE', 'TASK_DELETE', 'TASK_ASSIGN',
    'FORM_READ', 'FORM_CREATE', 'FORM_UPDATE', 'FORM_DELETE', 'FORM_SUBMIT',
    'EVALUATION_READ', 'EVALUATION_CREATE', 'EVALUATION_UPDATE',
    'ATTENDANCE_READ', 'ATTENDANCE_CREATE', 'ATTENDANCE_UPDATE', 'DOCUMENT_UPLOAD',
    'NOTIFICATION_READ', 'NOTIFICATION_CREATE'
  ];

  const techLeadPerms = [
    'PROJECT_READ', 'PROJECT_UPDATE', 'TASK_READ', 'TASK_CREATE', 'TASK_UPDATE', 'TASK_ASSIGN',
    'FORM_READ', 'DOCUMENT_UPLOAD'
  ];

  const internPerms = [
    'PROJECT_READ', 'TASK_READ', 'TASK_UPDATE', 'FORM_READ', 'FORM_SUBMIT',
    'ATTENDANCE_READ', 'ATTENDANCE_CREATE'
  ];

  const employeePerms = [
    'PROJECT_READ', 'TASK_READ', 'TASK_UPDATE', 'FORM_READ', 'FORM_SUBMIT',
    'ATTENDANCE_READ', 'ATTENDANCE_CREATE'
  ];

  console.log('Assigning permissions to roles...');
  const allPerms = await prisma.permission.findMany();
  const permMap = new Map(allPerms.map((p) => [p.name, p.id]));

  const assignPermsToRole = async (role: any, permList: string[]) => {
    if (!role) return;
    for (const pName of permList) {
      const pId = permMap.get(pName);
      if (pId) {
        await prisma.rolePermission.upsert({
          where: {
            role_id_permission_id: { role_id: role.id, permission_id: pId },
          },
          update: {},
          create: { role_id: role.id, permission_id: pId },
        });
      }
    }
  };

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const qaTesterRole = await prisma.role.findUnique({ where: { name: 'QA_TESTER' } });
  const developerRole = await prisma.role.findUnique({ where: { name: 'DEVELOPER' } });

  const qaPerms = [
    'PROJECT_READ', 'TASK_READ', 'TASK_UPDATE', 'DOCUMENT_UPLOAD', 'NOTIFICATION_READ'
  ];

  const devPerms = [
    'PROJECT_READ', 'TASK_READ', 'TASK_UPDATE', 'DOCUMENT_UPLOAD', 'NOTIFICATION_READ'
  ];

  await assignPermsToRole(superAdminRole, superAdminPerms);
  await assignPermsToRole(adminRole, managerPerms);
  await assignPermsToRole(managerRole, managerPerms);
  await assignPermsToRole(internRole, internPerms);
  await assignPermsToRole(employeeRole, employeePerms);
  await assignPermsToRole(techLeadRole, techLeadPerms);
  await assignPermsToRole(qaTesterRole, qaPerms);
  await assignPermsToRole(developerRole, devPerms);

  console.log('Roles and permissions configured.');

  // 4. Default Organization
  let org = await prisma.organization.findFirst({ where: { name: 'Dailoqa Technologies' } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Dailoqa Technologies' },
    });
  }

  await prisma.organizationWorkPolicy.upsert({
    where: { organization_id: org.id },
    update: {
      office_start_time: '09:00',
      office_end_time: '17:30',
      break_start_time: '13:00',
      break_end_time: '14:00',
      lunch_break_minutes: 60,
      timezone: 'Asia/Kolkata',
    },
    create: {
      organization_id: org.id,
      office_start_time: '09:00',
      office_end_time: '17:30',
      break_start_time: '13:00',
      break_end_time: '14:00',
      lunch_break_minutes: 60,
      timezone: 'Asia/Kolkata',
    },
  });

  console.log('Default organization and policy configured.');

  // 5. Create / Update Users
  console.log('Hashing default credentials and seeding users...');
  const passwordHash = await argon2.hash('password123');

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@dailoqa.com' },
    update: { organization_id: org.id, password_hash: passwordHash, must_change_password: false, is_active: true },
    create: {
      name: 'Super Administrator',
      email: 'superadmin@dailoqa.com',
      password_hash: passwordHash,
      organization_id: org.id,
      must_change_password: false,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@dailoqa.com' },
    update: { organization_id: org.id, password_hash: passwordHash, must_change_password: false, is_active: true },
    create: {
      name: 'Test Manager',
      email: 'manager@dailoqa.com',
      password_hash: passwordHash,
      organization_id: org.id,
      must_change_password: false,
    },
  });

  const intern = await prisma.user.upsert({
    where: { email: 'intern@dailoqa.com' },
    update: { organization_id: org.id, batch: 'Batch 2026-A', password_hash: passwordHash, must_change_password: false, is_active: true },
    create: {
      name: 'Test Intern',
      email: 'intern@dailoqa.com',
      password_hash: passwordHash,
      organization_id: org.id,
      batch: 'Batch 2026-A',
      must_change_password: false,
    },
  });

  const lead = await prisma.user.upsert({
    where: { email: 'lead@dailoqa.com' },
    update: { organization_id: org.id, password_hash: passwordHash, must_change_password: false, is_active: true },
    create: {
      name: 'Alex Tech Lead',
      email: 'lead@dailoqa.com',
      password_hash: passwordHash,
      organization_id: org.id,
      must_change_password: false,
    },
  });

  const qaUser = await prisma.user.upsert({
    where: { email: 'qa@dailoqa.com' },
    update: { organization_id: org.id, password_hash: passwordHash, must_change_password: false, is_active: true },
    create: {
      name: 'Priya QA Lead',
      email: 'qa@dailoqa.com',
      password_hash: passwordHash,
      organization_id: org.id,
      must_change_password: false,
    },
  });

  const devUser = await prisma.user.upsert({
    where: { email: 'developer@dailoqa.com' },
    update: { organization_id: org.id, password_hash: passwordHash, must_change_password: false, is_active: true },
    create: {
      name: 'Dev Dave',
      email: 'developer@dailoqa.com',
      password_hash: passwordHash,
      organization_id: org.id,
      must_change_password: false,
    },
  });

  console.log('Users seeded.');

  // 6. Assign Users to Roles
  const seededTechLeadRole = await prisma.role.findUnique({ where: { name: 'TECH_LEAD' } });
  const seededQaRole = await prisma.role.findUnique({ where: { name: 'QA_TESTER' } });
  const seededDevRole = await prisma.role.findUnique({ where: { name: 'DEVELOPER' } });

  if (superAdminRole && superAdmin) {
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: superAdmin.id, role_id: superAdminRole.id } },
      update: {},
      create: { user_id: superAdmin.id, role_id: superAdminRole.id },
    });
  }

  if (managerRole && manager) {
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: manager.id, role_id: managerRole.id } },
      update: {},
      create: { user_id: manager.id, role_id: managerRole.id },
    });
  }

  if (internRole && intern) {
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: intern.id, role_id: internRole.id } },
      update: {},
      create: { user_id: intern.id, role_id: internRole.id },
    });
  }

  if (seededTechLeadRole && lead) {
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: lead.id, role_id: seededTechLeadRole.id } },
      update: {},
      create: { user_id: lead.id, role_id: seededTechLeadRole.id },
    });
  }

  if (seededQaRole && qaUser) {
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: qaUser.id, role_id: seededQaRole.id } },
      update: {},
      create: { user_id: qaUser.id, role_id: seededQaRole.id },
    });
  }

  if (seededDevRole && devUser) {
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: devUser.id, role_id: seededDevRole.id } },
      update: {},
      create: { user_id: devUser.id, role_id: seededDevRole.id },
    });
  }

  // 7. Seed Sample Projects (Scrum and Kanban)
  let scrumProject = await prisma.project.findFirst({
    where: { name: 'Project Alpha - Core App (Scrum)' },
  });
  if (!scrumProject) {
    scrumProject = await prisma.project.create({
      data: {
        organization_id: org.id,
        owner_id: manager.id,
        name: 'Project Alpha - Core App (Scrum)',
        description: 'Core application workspace using Scrum methodology with sprints and QA retest workflows.',
        methodology: 'SCRUM',
        status: 'ACTIVE',
      },
    });
  }

  let kanbanProject = await prisma.project.findFirst({
    where: { name: 'Project Beta - Cloud Services (Kanban)' },
  });
  if (!kanbanProject) {
    kanbanProject = await prisma.project.create({
      data: {
        organization_id: org.id,
        owner_id: manager.id,
        name: 'Project Beta - Cloud Services (Kanban)',
        description: 'Cloud microservices workspace using continuous Kanban flow with defect triage and tracking.',
        methodology: 'KANBAN',
        status: 'ACTIVE',
      },
    });
  }

  // 8. Attach members to projects with distinct project-scoped roles
  console.log('Assigning project-scoped roles demonstrating dynamic team formation...');

  // Project Alpha (Scrum): Traditional role distribution
  const alphaMembers = [
    { user: manager, role: 'MANAGER' },
    { user: lead, role: 'TECH_LEAD' },
    { user: qaUser, role: 'QA_TESTER' },
    { user: devUser, role: 'DEVELOPER' },
    { user: intern, role: 'INTERN' },
  ];

  for (const m of alphaMembers) {
    await prisma.projectMember.upsert({
      where: { project_id_user_id: { project_id: scrumProject.id, user_id: m.user.id } },
      update: { project_role: m.role },
      create: { project_id: scrumProject.id, user_id: m.user.id, project_role: m.role },
    });
  }

  // Project Beta (Kanban): Inverted roles to prove project-scoped permissions
  // Dev Dave is Manager, Alex & Priya are Developers, Test Intern is QA Tester!
  const betaMembers = [
    { user: devUser, role: 'MANAGER' },
    { user: lead, role: 'DEVELOPER' },
    { user: qaUser, role: 'DEVELOPER' },
    { user: intern, role: 'QA_TESTER' },
    { user: manager, role: 'INTERN' },
  ];

  for (const m of betaMembers) {
    await prisma.projectMember.upsert({
      where: { project_id_user_id: { project_id: kanbanProject.id, user_id: m.user.id } },
      update: { project_role: m.role },
      create: { project_id: kanbanProject.id, user_id: m.user.id, project_role: m.role },
    });
  }

  // 9. Seed and Attach all 80 Interns
  console.log('Seeding bulk intern directory (80 interns)...');
  const internRecords = generateInternRecords(org.id, passwordHash);
  const createdInterns = [];

  for (const record of internRecords) {
    const u = await prisma.user.upsert({
      where: { email: record.email },
      update: {
        name: record.name,
        organization_id: record.organization_id,
        user_code: record.user_code,
        batch: record.batch,
        password_hash: record.password_hash,
        must_change_password: false,
        is_active: true,
      },
      create: record,
    });

    if (internRole) {
      await prisma.userRole.upsert({
        where: { user_id_role_id: { user_id: u.id, role_id: internRole.id } },
        update: {},
        create: { user_id: u.id, role_id: internRole.id },
      });
    }

    createdInterns.push(u);
  }

  // Add all interns to both projects as INTERN members
  for (const proj of [scrumProject, kanbanProject]) {
    for (const u of createdInterns) {
      await prisma.projectMember.upsert({
        where: { project_id_user_id: { project_id: proj.id, user_id: u.id } },
        update: { project_role: 'INTERN' },
        create: { project_id: proj.id, user_id: u.id, project_role: 'INTERN' },
      });
    }
  }
  console.log(`Attached ${createdInterns.length} interns to Project Alpha and Project Beta.`);

  // Seed sample sprint in Scrum project
  let sampleSprint = await prisma.sprint.findFirst({
    where: { project_id: scrumProject.id, name: 'Sprint 01 - Foundation' },
  });
  if (!sampleSprint) {
    await prisma.sprint.create({
      data: {
        organization_id: org.id,
        project_id: scrumProject.id,
        name: 'Sprint 01 - Foundation',
        goal: 'Complete core auth and defect management integration.',
        status: 'ACTIVE',
        start_date: new Date(),
        end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

