import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

export const INTERN_NAMES = [
  'J. Chaitanya Sai',
  'Nikhil Bisla',
  'Talapanti Rajesh',
  'Divyom Agrawal',
  'Yayivi Vinay',
  'K.Sriram Naveen',
  'D Anil Kumar',
  'Sameer Shukla',
  'Titirsha Singh',
  'Divyansh Agrawal',
  'Khushal Nivas Gourishetty',
  'Ansh Kukreti',
  'Manisha Parihar',
  'Anant Sharma',
  'Krish Jain',
  'Nishant Sindhu',
  'Saloni Rana',
  'Ayush V Panicker',
  'Aditya',
  'Sarthak Shah',
  'Nikhil sai vamshi krishna manam',
  'Akshat Bansal',
  'Sanka Maruthi Srujan',
  'Pranav Suresh',
  'Athira Ravi Pillai',
  'Khushi Bainsla',
  'Himanshu Gupta',
  'Siddhesh Chawande',
  'Ashish Rai',
  'Jatin Maurya',
  'Anshuman Mishra',
  'Anushka Sharna',
  'Jasleen Kaur',
  'Vakkalagadda Naga Venkata Sai Lakshmi Kanishka',
  'Akash Yadav',
  'Vaivashvat Upadhyay',
  'Anant Vaibhav',
  'Aryan Sharma',
  'Tanmay Garg',
  'Prince',
  'Pramod',
  'Sourabh Pal',
  'Akshat Awasthi',
  'Kanak Varshney',
  'Darsheel Jaiswal',
  'Garvita Singh',
  'Keshav Gupta',
  'Maddirala Namitha Reddy',
  'Pandraju Ganya Srihitha',
  'Akansha',
  'Jatin Malik',
  'Yash Tanwar',
  'Somepalli Raviteja',
  'Venkat Somanadh Mendu',
  'Deepanshu',
  'Korrapati Sridhar Reddy',
  'Saksham Gupta',
  'Anshuman Mathur',
  'Mayank Jain Malu',
  'Peram Mahendra Reddy',
  'Rohit Raghav',
  'Ananya Jain',
  'Jayesh Kansal',
  'Nitin Aman',
  'Keshav Agarwal',
  'Aditya Yadav',
  'Bharat Yadav',
  'Arth Saxena',
  'Piyush Yadav',
  'Ayush rai',
  'Bhavya Bhutani',
  'Mann Upadhyay',
  'Aditi',
  'Anushka Khare',
  'Nitin Singh',
  'Tanvi Kad',
  'Penmetsa Harsha Surya Gopal pradeep',
  'Sivaram Saran Alla',
  'Rudraraju sriram Sathvik varma',
  'Harsh Kumar',
];

export function generateInternRecords(orgId: string, passwordHash: string) {
  const emails = new Set<string>();
  const records = [];

  for (let i = 0; i < INTERN_NAMES.length; i++) {
    const rawName = INTERN_NAMES[i].trim();
    let sanitized = rawName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '');

    let email = `${sanitized}@dailoqa.com`;
    if (emails.has(email)) {
      email = `${sanitized}.${i + 1}@dailoqa.com`;
    }
    emails.add(email);

    const userCode = `INT-${String(i + 1).padStart(3, '0')}`;
    const batch = i < 40 ? 'Batch 2026-A' : 'Batch 2026-B';

    records.push({
      name: rawName,
      email,
      user_code: userCode,
      batch,
      password_hash: passwordHash,
      organization_id: orgId,
      must_change_password: false,
      is_active: true,
    });
  }

  return records;
}

async function main() {
  console.log(`Starting bulk import of ${INTERN_NAMES.length} interns...`);

  let org = await prisma.organization.findFirst({ where: { name: 'Dailoqa Technologies' } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: 'Dailoqa Technologies' } });
  }

  const internRole = await prisma.role.findUnique({ where: { name: 'INTERN' } });
  if (!internRole) {
    throw new Error('INTERN role not found. Please ensure seed has been initialized.');
  }

  console.log('Generating password hash...');
  const passwordHash = await argon2.hash('password123');

  const internRecords = generateInternRecords(org.id, passwordHash);

  console.log('Upserting intern users in database...');
  const createdUsers = [];

  for (const record of internRecords) {
    const user = await prisma.user.upsert({
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

    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: user.id, role_id: internRole.id } },
      update: {},
      create: { user_id: user.id, role_id: internRole.id },
    });

    createdUsers.push(user);
  }

  console.log(`Successfully seeded ${createdUsers.length} intern accounts!`);

  // Attach all interns to projects
  const projects = await prisma.project.findMany({
    where: { organization_id: org.id },
  });

  console.log(`Attaching interns to ${projects.length} organization projects as members...`);

  for (const proj of projects) {
    for (const u of createdUsers) {
      await prisma.projectMember.upsert({
        where: {
          project_id_user_id: {
            project_id: proj.id,
            user_id: u.id,
          },
        },
        update: { project_role: 'INTERN' },
        create: {
          project_id: proj.id,
          user_id: u.id,
          project_role: 'INTERN',
        },
      });
    }
    console.log(`Attached ${createdUsers.length} interns to project: ${proj.name}`);
  }

  console.log('All interns successfully added to database and projects!');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
