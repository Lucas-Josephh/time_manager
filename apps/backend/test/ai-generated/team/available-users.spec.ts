import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../support/http-test-app';

describe('Team HTTP API: available users', () => {
  let app: INestApplication;
  const getSession = jest.fn();
  const prisma = {
    team: { findMany: jest.fn(), findUnique: jest.fn() },
    organization: { findMany: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
  };
  const profile = { id: 'candidate', firstname: 'Alice', lastname: 'Martin' };
  const list = () => request(app.getHttpServer()).get('/api/team/available-users');

  beforeAll(async () => { app = await createHttpTestApp(prisma, getSession); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.resetAllMocks();
    getSession.mockResolvedValue({ user: { id: 'manager' } });
    prisma.user.findUnique.mockResolvedValue({ isAdmin: false });
    prisma.team.findMany.mockResolvedValue([{ organizationId: 'root' }]);
    prisma.organization.findMany.mockImplementation(async ({ where }) => {
      if (where.managerId) return [];
      const parents: string[] = where.parentId.in;
      if (parents.includes('root')) return [{ id: 'child' }];
      if (parents.includes('child')) return [{ id: 'grandchild' }];
      return [];
    });
    prisma.user.findMany.mockResolvedValue([profile]);
  });

  it('lists free users in the team manager’s complete subtree without a team ID', async () => {
    prisma.user.findMany.mockResolvedValue([
      { ...profile, image: 'private-image', email: 'private@example.com', isAdmin: true },
    ]);
    await list().expect(200).expect({
      success: true, message: 'team_available_users_listed', data: [profile],
    });
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(prisma.team.findUnique).not.toHaveBeenCalled();
    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: { managerId: 'manager' }, select: { organizationId: true },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { OR: [{ organizationId: { in: ['root', 'child', 'grandchild'] }, teamId: null }] },
      select: { id: true, firstname: true, lastname: true, image: true },
      orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }, { id: 'asc' }],
    });
  });

  it('allows administrators without any managed team or organization', async () => {
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    await list().expect(200);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({});
    expect(prisma.team.findMany).not.toHaveBeenCalled();
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('allows an organization manager before any team exists', async () => {
    prisma.team.findMany.mockResolvedValue([]);
    prisma.organization.findMany.mockImplementation(async ({ where }) =>
      where.managerId ? [{ id: 'root' }] : []);
    await list().expect(200);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ OR: [{
      organizationId: { in: ['root'] },
      OR: [{ teamId: null }, { team: { is: { organizationId: { in: ['root'] } } } }],
    }] });
  });

  it('rejects an authenticated user without management rights', async () => {
    prisma.team.findMany.mockResolvedValue([]);
    await list().expect(403).expect({ success: false, message: 'forbidden', data: {} });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('rejects a missing persisted actor', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await list().expect(403);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('authenticates before reading any scope', async () => {
    getSession.mockRejectedValue(new UnauthorizedException());
    await list().expect(401).expect({ success: false, message: 'unauthorized', data: {} });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.team.findMany).not.toHaveBeenCalled();
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty array when no users qualify', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await list().expect(200).expect({
      success: true, message: 'team_available_users_listed', data: [],
    });
  });

  it('handles duplicate roots and cycles without revisiting descendants', async () => {
    prisma.team.findMany.mockResolvedValue([
      { organizationId: 'root' }, { organizationId: 'root' }, { organizationId: 'child' },
    ]);
    prisma.organization.findMany.mockImplementation(async ({ where }) => {
      if (where.managerId) return [];
      return where.parentId.in.includes('root')
        ? [{ id: 'child' }, { id: 'child' }]
        : [{ id: 'root' }];
    });
    await list().expect(200);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ OR: [
      { organizationId: { in: ['root', 'child'] }, teamId: null },
    ] });
  });

  it('removes the previous team-specific route', async () => {
    await request(app.getHttpServer()).get('/api/team/old-team/available-users').expect(404);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
