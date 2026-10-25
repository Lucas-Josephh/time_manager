import { mockFindUniqueOrThrow } from './support/mock-find-unique-or-throw';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from './ai-generated/support/http-test-app';

type Row = Record<string, unknown>;

describe('Team membership permissions by actor', () => {
  let app: INestApplication;
  let actor = 'admin';
  let users: Row[];
  let teams: Row[];
  const organizations = [
    { id: 'root', parentId: null, managerId: 'org-manager' },
    { id: 'child', parentId: 'root', managerId: null },
    { id: 'deep', parentId: 'child', managerId: null },
    { id: 'sibling', parentId: 'root', managerId: null },
    { id: 'external', parentId: null, managerId: null },
  ];

  // Apply the actual Prisma predicates emitted by the service to persisted test rows.
  function matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, condition]) => {
      if (key === 'OR') return (condition as Row[]).some(part => matches(row, part));
      if (key === 'AND') return (condition as Row[]).every(part => matches(row, part));
      if (key === 'team') {
        const team = teams.find(item => item.id === row.teamId);
        return !!team && matches(team, (condition as { is: Row }).is);
      }
      if (condition && typeof condition === 'object') {
        const rule = condition as { in?: unknown[]; notIn?: unknown[]; not?: unknown };
        if (rule.in) return rule.in.includes(row[key]);
        if (rule.notIn) return !rule.notIn.includes(row[key]);
        if ('not' in rule) return row[key] !== rule.not;
      }
      return row[key] === condition;
    });
  }
  const prisma = {
    organization: {
      findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(async ({ where }) => organizations.find(item => matches(item, where)) ?? null),
      findMany: jest.fn(async ({ where }) => organizations.filter(item => matches(item, where))),
    },
    user: {
      count: jest.fn(async ({ where }) => users.filter(item => matches(item, where)).length),
      findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(async ({ where }) => users.find(item => matches(item, where)) ?? null),
      findMany: jest.fn(async ({ where }) => structuredClone(users.filter(item => matches(item, where)).map(item => ({ ...item, team: teams.find(team => team.id === item.teamId) ?? null })))),
      updateMany: jest.fn(async ({ where, data }) => {
        const selected = users.filter(item => matches(item, where));
        selected.forEach(item => Object.assign(item, data));
        return { count: selected.length };
      }),
    },
    team: {
      findMany: jest.fn(async ({ where }) => teams.filter(item => matches(item, where))),
      findFirst: jest.fn(async () => null),
      count: jest.fn(async ({ where }) => teams.filter(item => matches(item, where)).length),
      delete: jest.fn(async ({ where }) => { const team = teams.find(item => matches(item, where)); teams = teams.filter(item => !matches(item, where)); return team; }),
      findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(async ({ where }) => teams.find(item => matches(item, where)) ?? null),
      create: jest.fn(async ({ data }) => {
        const team = { id: 'created', ...data };
        teams.push(team);
        return team;
      }),
      update: jest.fn(async ({ where, data }) => {
        const team = teams.find(item => matches(item, where))!;
        Object.assign(team, data);
        return team;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const selected = teams.filter(item => matches(item, where));
        selected.forEach(item => Object.assign(item, data));
        return { count: selected.length };
      }),
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
      const savedUsers = structuredClone(users);
      const savedTeams = structuredClone(teams);
      try { return typeof callback === 'function' ? await callback(prisma) : await Promise.all(callback); }
      catch (error) { users = savedUsers; teams = savedTeams; throw error; }
    }),
  };
  beforeAll(async () => {
    app = await createHttpTestApp(prisma, async () => ({ user: { id: actor } }));
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.clearAllMocks();
    actor = 'admin';
    teams = [
      { id: 'target', name: 'Target', organizationId: 'child', managerId: 'team-manager' },
      { id: 'source', name: 'Source', organizationId: 'sibling', managerId: 'busy' },
      { id: 'outside', name: 'Outside', organizationId: 'external', managerId: 'external-user' },
    ];
    users = [
      { id: 'admin', isAdmin: true, organizationId: null, teamId: null },
      { id: 'org-manager', isAdmin: false, organizationId: 'root', teamId: null },
      { id: 'team-manager', isAdmin: false, organizationId: 'child', teamId: 'target' },
      { id: 'unassigned', organizationId: null, teamId: null },
      { id: 'available', organizationId: 'child', teamId: null },
      { id: 'deep-user', organizationId: 'deep', teamId: null },
      { id: 'sibling-user', organizationId: 'sibling', teamId: null },
      { id: 'busy', organizationId: 'sibling', teamId: 'source' },
      { id: 'external-user', organizationId: 'external', teamId: 'outside' },
      { id: 'external-team', organizationId: 'sibling', teamId: 'outside' },
    ].map(user => ({ firstname: 'Test', lastname: 'User', ...user }));
  });
  const add = (memberIds: string[]) => request(app.getHttpServer())
    .post('/api/team/target/members').send({ memberIds });
  const user = (id: string) => users.find(item => item.id === id)!;
  const transfer = (id: string, teamId = 'source') => request(app.getHttpServer())
    .post('/api/team/target/transfers').send({ userId: id, teamId });

  it('adds free users without changing organization', async () => {
    await add(['unassigned']).expect(201);
    expect(user('unassigned')).toMatchObject({ teamId: 'target', organizationId: null });
  });
  it('does not silently transfer busy users', async () => {
    await add(['busy']).expect(409);
    expect(user('busy').teamId).toBe('source');
  });
  it('transfers without changing responsibilities', async () => {
    await transfer('busy').expect(201);
    expect(user('busy').teamId).toBe('target');
    expect(teams.find(t => t.id === 'source')?.managerId).toBe('busy');
  });
  it('requires the explicit source to match', async () => {
    await transfer('busy', 'outside').expect(409);
    expect(user('busy').teamId).toBe('source');
  });
  it('allows a manager of both teams to transfer', async () => {
    actor = 'team-manager';
    teams.find(t => t.id === 'source')!.managerId = actor;
    await transfer('busy').expect(201);
  });
  it('requires authorization on both teams', async () => {
    actor = 'team-manager';
    await transfer('busy').expect(403);
  });
  it('combines organization and team candidate scopes', async () => {
    actor = 'org-manager';
    teams.push({ id: 'also', organizationId: 'external', managerId: actor });
    users.push({ id: 'external-free', organizationId: 'external', teamId: null });
    await add(['external-free', 'sibling-user']).expect(201);
  });
  it('lets team managers add descendants but rejects outsiders atomically', async () => {
    actor = 'team-manager';
    await add(['available', 'sibling-user']).expect(409);
    expect(user('available').teamId).toBeNull();
    await add(['available', 'deep-user']).expect(201);
  });
  it('never allows the manager to become a member', async () => {
    user('team-manager').teamId = null;
    await add(['team-manager']).expect(409);
  });
  it('requires explicit removal before appointing a member', async () => {
    user('available').teamId = 'target';
    await request(app.getHttpServer()).patch('/api/team/target/manager').send({ managerId: 'available' }).expect(409);
    await request(app.getHttpServer()).delete('/api/team/target/members/available').expect(200);
    await request(app.getHttpServer()).patch('/api/team/target/manager').send({ managerId: 'available' }).expect(200);
    expect(user('available').teamId).toBeNull();
  });
  it('appoints users belonging elsewhere without changing membership', async () => {
    await request(app.getHttpServer()).patch('/api/team/target/manager').send({ managerId: 'busy' }).expect(200);
    expect(user('busy').teamId).toBe('source');
    expect(teams.find(t => t.id === 'source')?.managerId).toBe('busy');
  });
  it('restricts manager changes and deletion to organization managers', async () => {
    actor = 'team-manager';
    await request(app.getHttpServer()).patch('/api/team/target/manager').send({ managerId: null }).expect(403);
    await request(app.getHttpServer()).delete('/api/team/target').expect(403);
    await request(app.getHttpServer()).patch('/api/team/target').send({ name: 'Renamed' }).expect(200);
  });
  it('rejects membership and manager fields in general patch', async () => {
    await request(app.getHttpServer()).patch('/api/team/target').send({ memberIds: [] }).expect(400);
    await request(app.getHttpServer()).patch('/api/team/target').send({ managerId: null }).expect(400);
  });
  it('rejects simple members from reads and candidate endpoints', async () => {
    actor = 'available';
    await request(app.getHttpServer()).get('/api/team/target').expect(403);
    await request(app.getHttpServer()).get('/api/team').expect(403);
    await request(app.getHttpServer()).get('/api/team/available-users?usage=member&teamId=target').expect(403);
  });
  it('requires explicit candidate usage and target', async () => {
    await request(app.getHttpServer()).get('/api/team/available-users').expect(400);
  });
  it('rolls back creation and earlier assignments if a transfer fails', async () => {
    await request(app.getHttpServer()).post('/api/team').send({ name: 'New', organizationId: 'child', memberIds: ['available', 'missing'] }).expect(409);
    expect(user('available').teamId).toBeNull();
    expect(teams.some(t => t.id === 'created')).toBe(false);
  });
  it('filters list rows and total by rights and requested filters', async () => {
    actor = 'org-manager';
    const response = await request(app.getHttpServer()).get('/api/team').expect(200);
    expect(response.body.data.items.map((t: { id: string }) => t.id).sort()).toEqual(['source', 'target']);
    expect(response.body.data.meta.total).toBe(2);
    await request(app.getHttpServer()).get('/api/team/outside').expect(403);
    const filtered = await request(app.getHttpServer()).get('/api/team?organizationId=external').expect(200);
    expect(filtered.body.data.items).toEqual([]);
    expect(filtered.body.data.meta.total).toBe(0);
  });
  it('lists only a team manager’s own teams', async () => {
    actor = 'team-manager';
    const response = await request(app.getHttpServer()).get('/api/team').expect(200);
    expect(response.body.data.items.map((t: { id: string }) => t.id)).toEqual(['target']);
  });
  it('rejects deleting a team with members', async () => {
    user('available').teamId = 'target';
    await request(app.getHttpServer()).delete('/api/team/target').expect(409);
    expect(teams.some(t => t.id === 'target')).toBe(true);
  });
  it('rejects automatic transfers from a source outside the actor’s scope', async () => {
    actor = 'org-manager';
    await request(app.getHttpServer()).post('/api/team')
      .send({ name: 'New', organizationId: 'child', memberIds: ['available', 'external-user'] })
      .expect(403);
    expect(user('available').teamId).toBeNull();
    expect(user('external-user').teamId).toBe('outside');
    expect(teams.some(t => t.id === 'created')).toBe(false);
  });
  it('rejects the removed transfers field', async () => {
    await request(app.getHttpServer()).post('/api/team')
      .send({ name: 'New', organizationId: 'child', transfers: [] })
      .expect(400);
  });
  it('creates with initial transfers while preserving source responsibilities', async () => {
    await request(app.getHttpServer()).post('/api/team').send({ name: 'New', organizationId: 'child', managerId: 'external-user', memberIds: ['busy', 'available'] }).expect(201);
    expect(user('busy').teamId).toBe('created');
    expect(user('available').teamId).toBe('created');
    expect(user('external-user').teamId).toBe('outside');
    expect(teams.find(t => t.id === 'source')?.managerId).toBe('busy');
  });

});
