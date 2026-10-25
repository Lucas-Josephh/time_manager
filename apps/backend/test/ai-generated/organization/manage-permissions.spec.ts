import { mockFindUniqueOrThrow } from '../../support/mock-find-unique-or-throw';
import type { INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from '../../../src/auth/auth.service';
import { createHttpTestApp } from '../support/http-test-app';

describe('Organization management permissions', () => {
  let app: INestApplication;
  let managed: string[] = [];
  const parents: Record<string, string | null> = {
    root: null,
    target: 'root',
    child: 'target',
    other: null,
  };
  const prisma = {
    user: { findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(), findMany: jest.fn() },
    organization: {
      findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  beforeAll(async () => {
    app = await createHttpTestApp(prisma);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    managed = [];
    prisma.user.findUnique.mockResolvedValue({ isAdmin: false });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.organization.findMany.mockResolvedValue([]);
    prisma.organization.findUnique.mockImplementation(async ({ where }) =>
      where.id in parents
        ? {
            id: where.id,
            parentId: parents[where.id],
            managerId: managed.includes(where.id) ? 'test-user' : null,
          }
        : null,
    );
    prisma.organization.create.mockResolvedValue({ id: 'new', name: 'New' });
    prisma.organization.update.mockResolvedValue({ id: 'target', name: 'New' });
    prisma.organization.delete.mockResolvedValue({
      id: 'target',
      name: 'Target',
    });
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  it.each(['post', 'patch', 'delete'] as const)(
    'authenticates before database lookups on %s',
    async (method) => {
      const session = jest
        .spyOn(app.get(AuthService), 'getSession')
        .mockRejectedValueOnce(new UnauthorizedException());
      try {
        await request(app.getHttpServer())
          [method](
            method === 'post'
              ? '/api/organizations'
              : '/api/organizations/target',
          )
          .send({ name: 'New' })
          .expect(401);
        expect(session).toHaveBeenCalledTimes(1);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.organization.findUnique).not.toHaveBeenCalled();
      } finally {
        session.mockRestore();
      }
    },
  );
  it('reserves root creation for administrators', async () => {
    managed = ['root'];
    await request(app.getHttpServer())
      .post('/api/organizations')
      .send({ name: 'New' })
      .expect(403);
    expect(prisma.organization.create).not.toHaveBeenCalled();
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    await request(app.getHttpServer())
      .post('/api/organizations')
      .send({ name: 'New' })
      .expect(201);
  });
  it.each(['target', 'root'])(
    'allows creation under an organization managed directly or through %s',
    async (managerRoot) => {
      managed = [managerRoot];
      await request(app.getHttpServer())
        .post('/api/organizations')
        .send({ name: 'New', parentId: 'target' })
        .expect(201);
    },
  );
  it.each(['patch', 'delete'] as const)(
    'allows local and ancestor management on %s',
    async (method) => {
      for (const scope of ['target', 'root']) {
        managed = [scope];
        await request(app.getHttpServer())
          [method]('/api/organizations/target')
          .send({ name: 'New' })
          .expect(200);
      }
    },
  );
  it.each(['post', 'patch', 'delete'] as const)(
    'denies unrelated organization and team managers on %s',
    async (method) => {
      managed = ['other'];
      await request(app.getHttpServer())
        [method](
          method === 'post'
            ? '/api/organizations'
            : '/api/organizations/target',
        )
        .send({
          name: 'New',
          ...(method === 'post' ? { parentId: 'target' } : {}),
        })
        .expect(403);
      expect(prisma.organization.create).not.toHaveBeenCalled();
      expect(prisma.organization.update).not.toHaveBeenCalled();
      expect(prisma.organization.delete).not.toHaveBeenCalled();
    },
  );
  it('checks both the current scope and the new parent', async () => {
    for (const scopes of [['target'], ['other']]) {
      managed = scopes;
      await request(app.getHttpServer())
        .patch('/api/organizations/target')
        .send({ parentId: 'other' })
        .expect(403);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    }
    managed = ['target', 'other'];
    await request(app.getHttpServer())
      .patch('/api/organizations/target')
      .send({ parentId: 'other' })
      .expect(200);
  });
  it('requires an administrator to detach an organization into a root', async () => {
    managed = ['target'];
    await request(app.getHttpServer())
      .patch('/api/organizations/target')
      .send({ parentId: null })
      .expect(403);
    expect(prisma.organization.update).not.toHaveBeenCalled();
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    await request(app.getHttpServer())
      .patch('/api/organizations/target')
      .send({ parentId: null })
      .expect(200);
  });
  it('allows the existing root manager to preserve a null parent', async () => {
    managed = ['root'];
    await request(app.getHttpServer())
      .patch('/api/organizations/root')
      .send({ parentId: null })
      .expect(200);
  });
  it('does not grant rights from the requested managerId', async () => {
    await request(app.getHttpServer())
      .patch('/api/organizations/target')
      .send({ managerId: 'test-user' })
      .expect(403);
  });
  it('denies deleted users and terminates cyclic ancestry lookups', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .delete('/api/organizations/target')
      .expect(403);
    prisma.organization.findUnique.mockResolvedValue({
      parentId: 'target',
      managerId: null,
    });
    await request(app.getHttpServer())
      .delete('/api/organizations/target')
      .expect(403);
  });
});
