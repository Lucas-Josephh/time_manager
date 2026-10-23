import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from './support/http-test-app';

describe('Resource lookup and validation order', () => {
  let app: INestApplication;
  const session = jest.fn();
  const prisma = {
    team: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    organization: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn(),
  };
  beforeAll(async () => { app = await createHttpTestApp(prisma, session); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.resetAllMocks();
    session.mockResolvedValue({ user: { id: 'test-user' } });
    prisma.team.findUnique.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue(null);
  });

  it.each([
    ['/api/team/missing', 'team'],
    ['/api/team/missing/available-users', 'team'],
    ['/api/organizations/missing', 'organization'],
    ['/api/organizations/missing/tree', 'organization'],
  ] as const)('returns 404 for a missing resource on %s', async (path, model) => {
    await request(app.getHttpServer()).get(path).expect(404)
      .expect({ success: false, message: 'not_found', data: {} });
    expect(prisma[model].findUnique).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['put', '/api/team/missing'],
    ['patch', '/api/team/missing'],
    ['patch', '/api/organizations/missing'],
  ] as const)('returns 404 before validating the body on %s %s', async (method, path) => {
    await request(app.getHttpServer())[method](path)
      .send({ name: 42, unexpected: true }).expect(404)
      .expect({ success: false, message: 'not_found', data: {} });
    expect(prisma.team.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['team', 'organizations'] as const)('maps a missing delete target on %s', async (resource) => {
    const model = resource === 'team' ? 'team' : 'organization';
    await request(app.getHttpServer()).delete(`/api/${resource}/missing`).expect(404);
    expect(prisma[model].findUnique).toHaveBeenCalledTimes(1);
    expect(prisma[model].delete).not.toHaveBeenCalled();
  });

  it.each(['/api/organizations/missing', '/api/team/missing/available-users'])(
    'authenticates before looking up %s', async (path) => {
    session.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer()).get(path).expect(401);
    expect(prisma.team.findUnique).not.toHaveBeenCalled();
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });
});
