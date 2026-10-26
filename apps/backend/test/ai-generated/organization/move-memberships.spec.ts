import { mockFindUniqueOrThrow } from '../../support/mock-find-unique-or-throw';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../support/http-test-app';

describe('Organization moves preserve team memberships', () => {
  let app: INestApplication;
  let parents: Record<string, string | null>;
  let members: Array<{
    id: string;
    firstname: string;
    lastname: string;
    organizationId: string;
    teamId: string | null;
  }>;
  const teams: Record<string, string> = {
    'team-a': 'a',
    'team-root': 'root',
    'team-b': 'b',
  };
  const prisma = {
    $transaction: jest.fn(),
    organization: {
      findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: { findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(), findMany: jest.fn() },
  };
  const member = (organizationId: string, teamId: string | null) => ({
    id: 'member',
    firstname: 'Alice',
    lastname: 'Martin',
    organizationId,
    teamId,
  });
  beforeAll(async () => {
    app = await createHttpTestApp(prisma);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    parents = {
      root: null,
      a: 'root',
      b: 'a',
      deep: 'b',
      c: 'root',
      sibling: 'a',
    };
    members = [];
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    prisma.organization.findUnique.mockImplementation(async ({ where }) =>
      where.id in parents
        ? { id: where.id, parentId: parents[where.id], managerId: null }
        : null,
    );
    prisma.organization.findMany.mockImplementation(async ({ where }) =>
      Object.entries(parents)
        .filter(([, parentId]) => where.parentId.in.includes(parentId))
        .map(([id]) => ({ id })),
    );
    prisma.organization.update.mockImplementation(async ({ where, data }) => {
      if (data.parentId !== undefined) parents[where.id] = data.parentId;
      return { id: where.id, parentId: parents[where.id], ...data };
    });
    prisma.user.findMany.mockImplementation(async ({ where }) =>
      members
        .filter(
          (user) =>
            where.organizationId.in.includes(user.organizationId) &&
            user.teamId !== null &&
            where.team.is.organizationId.in.includes(teams[user.teamId]),
        )
        .map(({ id, firstname, lastname, teamId }) => ({
          id,
          firstname,
          lastname,
          teamId,
        })),
    );
  });

  it.each([
    ['b', 'team-a'],
    ['deep', 'team-a'],
    ['deep', 'team-b'],
    ['b', 'team-root'],
    ['deep', null],
    ['c', 'team-a'],
  ] as const)('preserves independent membership %s / %s when moving the branch', async (organizationId, teamId) => {
    members = [member(organizationId, teamId)];
    const before = structuredClone(members);
    await request(app.getHttpServer()).patch('/api/organizations/b')
      .send({ parentId: 'c' }).expect(200);
    expect(parents.b).toBe('c');
    expect(members).toEqual(before);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('allows detaching a branch without modifying its users or teams', async () => {
    members = [member('b', 'team-root')];
    await request(app.getHttpServer()).patch('/api/organizations/b')
      .send({ parentId: null }).expect(200);
    expect(parents.b).toBeNull();
    expect(members[0].teamId).toBe('team-root');
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
