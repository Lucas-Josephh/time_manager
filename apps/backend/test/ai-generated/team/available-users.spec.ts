import { mockFindUniqueOrThrow } from '../../support/mock-find-unique-or-throw';
import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../support/http-test-app';

describe('Team HTTP API: available users', () => {
  let app: INestApplication;
  const getSession = jest.fn();
  const prisma = {
    team: { findUniqueOrThrow: mockFindUniqueOrThrow, findMany: jest.fn(), findUnique: jest.fn() },
    organization: { findUnique: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
  };
  const profile = { id: 'candidate', firstname: 'Alice', lastname: 'Martin' };
  const list = () => request(app.getHttpServer()).get('/api/team/available-users?usage=member&teamId=target');

  beforeAll(async () => { app = await createHttpTestApp(prisma, getSession); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.resetAllMocks();
    getSession.mockResolvedValue({ user: { id: 'manager' } });
    prisma.user.findUnique.mockResolvedValue({ isAdmin: false });
    prisma.team.findUnique.mockResolvedValue({ id: 'target', organizationId: 'root', managerId: 'manager' });
    prisma.organization.findUnique.mockResolvedValue({ id: 'root', managerId: null });
    prisma.team.findMany.mockResolvedValue([{ organizationId: 'root' }]);
    prisma.organization.findMany.mockImplementation(async ({ where }) => {
      if (where.managerId) return [];
      if (where.id) return where.id.in.map((id: string) => ({ id }));
      const parents: string[] = where.parentId.in;
      if (parents.includes('root')) return [{ id: 'child' }];
      if (parents.includes('child')) return [{ id: 'grandchild' }];
      return [];
    });
    prisma.user.findMany.mockResolvedValue([profile]);
  });

  it('lists free users in all managed subtrees for an explicit target', async () => {
    await list().expect(200).expect({ success: true, message: 'team_available_users_listed', data: [profile] });
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ AND: [
      { teamId: null, organizationId: { in: ['root', 'child', 'grandchild'] } },
      { id: { not: 'manager' } },
    ] });
  });
  it('allows administrators across all organizations', async () => {
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    await list().expect(200);
    expect(prisma.user.findMany.mock.calls[0][0].where.AND[0]).toEqual({ teamId: null });
  });
  it('requires rights over the target', async () => {
    prisma.team.findUnique.mockResolvedValue({ id: 'target', organizationId: 'root', managerId: 'other' });
    await list().expect(403);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
  it('allows manager candidates belonging to another team', async () => {
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    await request(app.getHttpServer()).get('/api/team/available-users?usage=manager&teamId=target').expect(200);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ OR: [{ teamId: null }, { teamId: { not: 'target' } }] });
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
      if (where.id) return where.id.in.map((id: string) => ({ id }));
      return where.parentId.in.includes('root')
        ? [{ id: 'child' }, { id: 'child' }]
        : [{ id: 'root' }];
    });
    await list().expect(200);
    expect(prisma.user.findMany.mock.calls[0][0].where.AND[0]).toEqual({ organizationId: { in: ['root', 'child'] }, teamId: null });
  });

  it('removes the previous team-specific route', async () => {
    await request(app.getHttpServer()).get('/api/team/old-team/available-users').expect(404);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
