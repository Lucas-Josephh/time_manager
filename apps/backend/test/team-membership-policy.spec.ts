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
      findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(async ({ where }) => users.find(item => matches(item, where)) ?? null),
      findMany: jest.fn(async ({ where }) => structuredClone(users.filter(item => matches(item, where)).map(item => ({ ...item, team: teams.find(team => team.id === item.teamId) ?? null })))),
      updateMany: jest.fn(async ({ where, data }) => {
        const selected = users.filter(item => matches(item, where));
        selected.forEach(item => Object.assign(item, data));
        return { count: selected.length };
      }),
    },
    team: {
      findFirst: jest.fn(async () => null),
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
      try { return await callback(prisma); }
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
    .patch('/api/team/target').send({ memberIds });
  const user = (id: string) => users.find(item => item.id === id)!;

  it('lets an admin add an organization-less user and transfer an external member without changing either organization', async () => {
    await add(['unassigned', 'external-user']).expect(200);
    expect(user('unassigned')).toMatchObject({ teamId: 'target', organizationId: null });
    expect(user('external-user')).toMatchObject({ teamId: 'target', organizationId: 'external' });
    expect(teams.find(team => team.id === 'outside')?.managerId).toBeNull();
  });

  it('allows the same cross-organization assignment when an admin creates a team', async () => {
    await request(app.getHttpServer()).post('/api/team')
      .send({ name: 'New', organizationId: 'child', memberIds: ['unassigned', 'external-user'] }).expect(201);
    expect(user('external-user')).toMatchObject({ teamId: 'created', organizationId: 'external' });
  });

  it.each(['patch', 'put'] as const)('lets an org manager transfer between sibling organizations via %s', async method => {
    actor = 'org-manager';
    await request(app.getHttpServer())[method]('/api/team/target')
      .send({ name: 'Target', organizationId: 'child', memberIds: ['busy', 'sibling-user'] }).expect(200);
    expect(user('busy')).toMatchObject({ teamId: 'target', organizationId: 'sibling' });
    expect(user('sibling-user')).toMatchObject({ teamId: 'target', organizationId: 'sibling' });
    expect(teams.find(team => team.id === 'source')?.managerId).toBeNull();
  });

  it.each(['external-user', 'external-team', 'unassigned'])('blocks an org manager from transferring %s outside their scope', async id => {
    actor = 'org-manager';
    const before = structuredClone(users);
    const response = await add(['available', id]).expect(409);
    expect(response.body.data.unavailableMembers).toContainEqual(expect.objectContaining({ id, reason: 'outside_organization' }));
    expect(users).toEqual(before);
  });

  it('lets a team manager add an available user in their team organization', async () => {
    actor = 'team-manager';
    await add(['available', 'deep-user']).expect(200);
    expect(user('available')).toMatchObject({ teamId: 'target', organizationId: 'child' });
    expect(user('deep-user')).toMatchObject({ teamId: 'target', organizationId: 'deep' });
  });

  it.each(['busy', 'sibling-user', 'unassigned', 'external-user'])('blocks a team manager from adding %s', async id => {
    actor = 'team-manager';
    const before = structuredClone(users);
    await add([id]).expect(409);
    expect(users).toEqual(before);
  });

  it('keeps existing cross-organization members when a team manager changes the member list', async () => {
    user('external-user').teamId = 'target';
    actor = 'team-manager';
    await add(['external-user', 'available']).expect(200);
    expect(user('external-user')).toMatchObject({ teamId: 'target', organizationId: 'external' });
  });

  it.each([
    ['admin', ['unassigned', 'busy', 'external-user']],
    ['org-manager', ['busy', 'sibling-user']],
    ['team-manager', ['available']],
  ] as const)('lists eligible candidates for %s', async (id, expected) => {
    actor = id;
    const response = await request(app.getHttpServer()).get('/api/team/target/available-users').expect(200);
    const ids = response.body.data.map((item: { id: string }) => item.id);
    expect(ids).toEqual(expect.arrayContaining(expected));
    expect(ids).not.toContain('team-manager');
    if (id !== 'admin') expect(ids).not.toContain('external-user');
    if (id === 'team-manager') expect(ids).not.toContain('busy');
  });

  it('rolls back an entire admin request when one of its members does not exist', async () => {
    const before = structuredClone(users);
    await add(['external-user', 'missing']).expect(409);
    expect(users).toEqual(before);
    expect(teams.find(team => team.id === 'outside')?.managerId).toBe('external-user');
  });
});
