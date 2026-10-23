import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { createHttpTestApp } from './support/http-test-app';

describe('Organization and team write response models', () => {
  let app: INestApplication;
  const dates = { createdAt: '2026-10-18T10:00:00.000Z', updatedAt: '2026-10-18T10:00:00.000Z' };
  const organization = { id: 'org', name: 'Finance', parentId: null, managerId: null, ...dates };
  const team = { id: 'team', name: 'Support', organizationId: 'org', managerId: null, ...dates };
  const person = { id: 'manager', firstname: 'Doryan', lastname: 'Bessiere' };
  const enrichedTeam = { ...team, organization, manager: person, members: [person] };
  const extra = { organization, manager: { ...person, email: 'private@example.com' }, members: [{ ...person, password: 'private' }], users: [], children: [], internal: true };
  const prisma = {
    team: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), updateMany: jest.fn() },
    organization: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  beforeAll(async () => { app = await createHttpTestApp(prisma); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.team.findUnique.mockResolvedValue({ ...team, ...extra });
    prisma.team.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ ...person, isAdmin: true });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.organization.findMany.mockResolvedValue([]);
    prisma.team.create.mockResolvedValue({ ...team, ...extra });
    prisma.team.update.mockResolvedValue({ ...team, ...extra });
    prisma.organization.findUnique.mockResolvedValue(organization);
    prisma.organization.create.mockResolvedValue({ ...organization, ...extra });
    prisma.organization.update.mockResolvedValue({ ...organization, ...extra });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  });

  it('returns the same complete team summary on POST, PUT and PATCH', async () => {
    for (const method of ['post', 'put', 'patch'] as const) {
      const path = method === 'post' ? '/api/team' : '/api/team/team';
      const response = await request(app.getHttpServer())[method](path)
        .send({ name: 'Support', organizationId: 'org' }).expect(method === 'post' ? 201 : 200);
      expect(response.body.data).toEqual(enrichedTeam);
    }
  });

  it.each(['post', 'put', 'patch'] as const)('reads relations after assigning members in %s', async method => {
    let assigned = false;
    prisma.team.create.mockResolvedValue(team);
    prisma.team.update.mockResolvedValue(team);
    prisma.user.updateMany.mockImplementation(async () => { assigned = true; return { count: 1 }; });
    prisma.team.findUnique.mockImplementation(async ({ include }: { include?: unknown }) => {
      if (!include) return team;
      expect(assigned).toBe(true);
      return { ...team, ...extra };
    });
    const response = await request(app.getHttpServer())[method](method === 'post' ? '/api/team' : '/api/team/team')
      .send({ name: 'Support', organizationId: 'org', memberIds: ['manager'] })
      .expect(method === 'post' ? 201 : 200);
    expect(response.body.data).toEqual(enrichedTeam);
    expect(prisma.team.findUnique).toHaveBeenCalledWith({
      where: { id: 'team' }, include: { manager: true, organization: true, members: true },
    });
  });

  it('returns the same complete organization summary on POST and PATCH', async () => {
    for (const method of ['post', 'patch'] as const) {
      const path = method === 'post' ? '/api/organizations' : '/api/organizations/org';
      const response = await request(app.getHttpServer())[method](path)
        .send({ name: 'Finance' }).expect(method === 'post' ? 201 : 200);
      expect(response.body.data).toEqual(organization);
    }
  });

  it('documents one summary schema per resource for all writes', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    for (const [path, method, status, dto] of [
      ['/api/team', 'post', '201', 'TeamWithRelationsDto'],
      ['/api/team/{id}', 'put', '200', 'TeamWithRelationsDto'],
      ['/api/team/{id}', 'patch', '200', 'TeamWithRelationsDto'],
      ['/api/organizations', 'post', '201', 'OrganizationDetailsDto'],
      ['/api/organizations/{id}', 'patch', '200', 'OrganizationDetailsDto'],
    ] as const) {
      expect(document.paths[path][method]!.responses[status]).toMatchObject({
        content: { 'application/json': { schema: { properties: {
          data: { $ref: `#/components/schemas/${dto}` },
        } } } },
      });
    }
  });
});
