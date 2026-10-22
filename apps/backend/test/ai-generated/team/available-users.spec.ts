import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../support/http-test-app';

describe('Team HTTP API: available users', () => {
  let app: INestApplication;
  const getSession = jest.fn();
  const prisma = {
    team: { findUnique: jest.fn() },
    organization: { findMany: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
  };
  const profile = {
    id: 'candidate',
    firstname: 'Alice',
    lastname: 'Martin',
  };

  beforeAll(async () => {
    app = await createHttpTestApp(prisma, getSession);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    getSession.mockResolvedValue({ user: { id: 'manager' } });
    prisma.team.findUnique.mockResolvedValue({
      organizationId: 'root',
      managerId: 'manager',
    });
    prisma.user.findUnique.mockResolvedValue({ isAdmin: false });
    prisma.organization.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([profile]);
  });

  it('allows the manager and restricts the query to unassigned users in the complete subtree', async () => {
    prisma.organization.findMany
      .mockResolvedValueOnce([{ id: 'child' }, { id: 'sibling' }])
      .mockResolvedValueOnce([{ id: 'grandchild' }])
      .mockResolvedValueOnce([]);
    // Extra fields must also be stripped by the method-level serializer.
    prisma.user.findMany.mockResolvedValue([
      { ...profile, image: 'private-image', email: 'private@example.com', isAdmin: true },
    ]);
    await request(app.getHttpServer())
      .get('/api/team/team-id/available-users')
      .expect(200)
      .expect({
        success: true,
        message: 'team_available_users_listed',
        data: [profile],
      });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'manager' },
      select: { isAdmin: true },
    });
    expect(prisma.organization.findMany.mock.calls).toEqual([
      [{ where: { parentId: { in: ['root'] } }, select: { id: true } }],
      [
        {
          where: { parentId: { in: ['child', 'sibling'] } },
          select: { id: true },
        },
      ],
      [{ where: { parentId: { in: ['grandchild'] } }, select: { id: true } }],
    ]);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: { in: ['root', 'child', 'sibling', 'grandchild'] },
        teamId: null,
      },
      select: { id: true, firstname: true, lastname: true, image: true },
      orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }, { id: 'asc' }],
    });
  });

  it('allows an administrator who does not manage the team', async () => {
    getSession.mockResolvedValue({ user: { id: 'admin' } });
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    await request(app.getHttpServer())
      .get('/api/team/team-id/available-users')
      .expect(200);
  });

  it('rejects a whitespace-only team identifier before querying the database', async () => {
    await request(app.getHttpServer())
      .get('/api/team/%20%20/available-users')
      .expect(400)
      .expect({
        success: false,
        message: 'validation_failed',
        data: { errors: [{ field: 'id', messages: ['is_required'] }] },
      });
    expect(prisma.team.findUnique).not.toHaveBeenCalled();
  });

  it('trims the team identifier and accepts existing non-UUID identifiers', async () => {
    await request(app.getHttpServer())
      .get('/api/team/%20team-id%20/available-users')
      .expect(200);
    expect(prisma.team.findUnique).toHaveBeenCalledWith({
      where: { id: 'team-id' },
      select: { organizationId: true, managerId: true },
    });
  });

  it.each(['employee', 'other-manager'])(
    'rejects an unauthorized user: %s',
    async (id) => {
      getSession.mockResolvedValue({ user: { id, isAdmin: true } });
      await request(app.getHttpServer())
        .get('/api/team/team-id/available-users')
        .expect(403)
        .expect({ success: false, message: 'forbidden', data: {} });
      expect(prisma.organization.findMany).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    },
  );

  it('rejects an expired or missing session before reading the team', async () => {
    getSession.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .get('/api/team/team-id/available-users')
      .expect(401)
      .expect({ success: false, message: 'unauthorized', data: {} });
    expect(prisma.team.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing team', async () => {
    prisma.team.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/api/team/missing/available-users')
      .expect(404)
      .expect({ success: false, message: 'not_found', data: {} });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty array when no users qualify', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/team/team-id/available-users')
      .expect(200)
      .expect({
        success: true,
        message: 'team_available_users_listed',
        data: [],
      });
  });

  it('stops revisiting organizations when the hierarchy contains duplicates or a cycle', async () => {
    prisma.organization.findMany
      .mockResolvedValueOnce([{ id: 'child' }, { id: 'child' }])
      .mockResolvedValueOnce([{ id: 'root' }]);
    await request(app.getHttpServer())
      .get('/api/team/team-id/available-users')
      .expect(200);
    expect(prisma.organization.findMany).toHaveBeenCalledTimes(2);
    expect(
      prisma.user.findMany.mock.calls[0][0].where.organizationId.in,
    ).toEqual(['root', 'child']);
  });
});
