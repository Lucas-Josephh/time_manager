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
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
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

  it.each(['b', 'deep'])(
    'refuses a move that invalidates a member attached to %s',
    async (organizationId) => {
      members = [member(organizationId, 'team-a')];
      const response = await request(app.getHttpServer())
        .patch('/api/organizations/b')
        .send({ parentId: 'c' })
        .expect(409);
      expect(response.body).toEqual({
        success: false,
        message: 'organization_move_invalidates_team_memberships',
        data: {
          affectedMembers: [
            {
              id: 'member',
              firstname: 'Alice',
              lastname: 'Martin',
              teamId: 'team-a',
            },
          ],
        },
      });
      expect(prisma.organization.update).not.toHaveBeenCalled();
      expect(parents.b).toBe('a');
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: { in: ['b', 'deep'] },
            team: { is: { organizationId: { in: ['a'] } } },
          },
        }),
      );
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });
    },
  );

  it.each([
    ['deep', 'team-b'], // Team and user stay inside the moved branch.
    ['b', 'team-root'], // The common root remains an ancestor.
    ['deep', null], // Users without a team cannot lose membership eligibility.
    ['c', 'team-a'], // An existing inconsistency outside the moved branch is unrelated.
  ] as const)(
    'preserves unaffected membership %s / %s',
    async (organizationId, teamId) => {
      members = [member(organizationId, teamId)];
      await request(app.getHttpServer())
        .patch('/api/organizations/b')
        .send({ parentId: 'c' })
        .expect(200);
      expect(parents.b).toBe('c');
    },
  );

  it('allows a move within the same ancestor scope', async () => {
    members = [member('deep', 'team-a')];
    await request(app.getHttpServer())
      .patch('/api/organizations/b')
      .send({ parentId: 'sibling' })
      .expect(200);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('rejects detaching the branch when members belong to a former ancestor team', async () => {
    members = [member('b', 'team-root')];
    await request(app.getHttpServer())
      .patch('/api/organizations/b')
      .send({ parentId: null })
      .expect(409);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('allows moving an empty branch and skips checks for an unchanged parent', async () => {
    await request(app.getHttpServer())
      .patch('/api/organizations/b')
      .send({ parentId: 'c' })
      .expect(200);
    prisma.user.findMany.mockClear();
    await request(app.getHttpServer())
      .patch('/api/organizations/b')
      .send({ parentId: 'c' })
      .expect(200);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('does not inspect memberships for an ordinary name change', async () => {
    await request(app.getHttpServer())
      .patch('/api/organizations/b')
      .send({ name: 'Renamed' })
      .expect(200);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('propagates membership lookup failures without changing the parent', async () => {
    prisma.user.findMany.mockRejectedValue(new Error('Database unavailable'));
    await request(app.getHttpServer())
      .patch('/api/organizations/b')
      .send({ parentId: 'c' })
      .expect(500);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });
});
