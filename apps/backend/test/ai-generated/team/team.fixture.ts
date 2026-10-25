import { mockFindUniqueOrThrow } from '../../support/mock-find-unique-or-throw';
import type { INestApplication } from '@nestjs/common';
import { createHttpTestApp } from '../support/http-test-app';

export function useTeamFixture() {
  let app: INestApplication;
  const prisma = {
    $transaction: jest.fn(),
    team: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    organization: { findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(), findMany: jest.fn() },
    user: { findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
  };
  const dto = { name: 'Support', organizationId: 'department-it' };
  const team = { id: 'team-support', ...dto, managerId: null };
  const relations = { manager: true, organization: true, members: true };
  const envelope = (message: string, data: unknown, success = true) => ({
    success,
    message,
    data,
  });
  beforeAll(async () => {
    app = await createHttpTestApp(prisma);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) => typeof callback === 'function' ? callback(prisma) : Promise.all(callback));
    prisma.organization.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockImplementation(async ({ where }) =>
      (where.id?.in ?? []).map((id: string) => ({
        id, firstname: 'Test', lastname: 'User', teamId: null,
        organizationId: dto.organizationId, team: null,
      })),
    );
    prisma.user.updateMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) => Promise.resolve({ count: where.id.in.length }));
    prisma.team.findFirst.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue({ id: dto.organizationId });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-manager', isAdmin: true });
    prisma.team.create.mockResolvedValue(team);
    prisma.team.update.mockResolvedValue(team);
    prisma.team.delete.mockResolvedValue(team);
    prisma.team.findUnique.mockResolvedValue(team);
    prisma.team.findMany.mockResolvedValue([team]);
    prisma.team.count.mockResolvedValue(1);
  });
  return {
    get app() {
      return app;
    },
    prisma,
    dto,
    team,
    relations,
    envelope,
  };
}
