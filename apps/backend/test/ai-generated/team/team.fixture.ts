import type { INestApplication } from '@nestjs/common';
import { AuthService } from '../../../src/auth/auth.service';
import { createHttpTestApp } from '../support/http-test-app';

export function useTeamFixture() {
  let app: INestApplication;
  const prisma = {
    team: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    department: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const dto = { name: 'Support', departmentId: 'department-it' };
  const team = { id: 'team-support', ...dto, managerId: null };
  const relations = { manager: true, department: true, members: true };
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
    jest.mocked(app.get(AuthService).getSession).mockResolvedValue({
      user: { id: 'user-manager' },
      session: { id: 'test-session' },
    } as Awaited<ReturnType<AuthService['getSession']>>);
    prisma.team.findFirst.mockResolvedValue(null);
    prisma.department.findUnique.mockResolvedValue({ id: dto.departmentId });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-manager' });
    prisma.team.create.mockResolvedValue(team);
    prisma.team.update.mockResolvedValue(team);
    prisma.team.delete.mockResolvedValue(team);
    prisma.team.findUnique.mockResolvedValue(team);
    prisma.team.findMany.mockResolvedValue([team]);
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
