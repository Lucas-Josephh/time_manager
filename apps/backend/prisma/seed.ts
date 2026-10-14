import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function seedDepartments() {
  const departments = [
    { id: 'department-hr', name: 'HR' },
    { id: 'department-finance', name: 'Finance' },
    { id: 'department-it', name: 'IT' },
    { id: 'department-operations', name: 'Operations' },
    { id: 'department-customer-service', name: 'Customer Service' },
  ];

  for (const department of departments) {
    await prisma.department.upsert({
      where: { id: department.id },
      update: { name: department.name },
      create: department,
    });
  }
}

async function seedDefaultUsers() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD sont requis');
  }

  const hashedPassword = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const team = await tx.team.upsert({
      where: { name: 'Administration' },
      update: {},
      create: {
        id: 'team-administration',
        name: 'Administration',
        departmentId: 'department-operations',
      },
    });

    const user = await tx.user.upsert({
      where: { email },
      update: {},
      create: {
        id: 'default-admin',
        teamId: team.id,
        firstname: 'Admin',
        lastname: 'Time Manager',
        email,
        emailVerified: true,
        isAdmin: true,
      },
    });

    if (!team.managerId) {
      await tx.team.update({
        where: { id: team.id },
        data: { managerId: user.id },
      });
    }

    const account = await tx.account.findFirst({
      where: {
        userId: user.id,
        providerId: 'credential',
      },
    });

    if (!account) {
      await tx.account.create({
        data: {
          id: `credential-${user.id}`,
          userId: user.id,
          accountId: user.id,
          providerId: 'credential',
          password: hashedPassword,
        },
      });
    }
  });
}

async function main() {
  await seedDepartments();
  await seedDefaultUsers();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
