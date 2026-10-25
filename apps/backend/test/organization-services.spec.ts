import { OrganizationHierarchyService } from '../src/organization/services/organization-hierarchy.service';
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OrganizationService } from '../src/organization/services/organization.service';
import { OrganizationAuthorizationService } from '../src/organization/services/organization-authorization.service';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { mockFindUniqueOrThrow } from './support/mock-find-unique-or-throw';

describe('Organization providers and transactional permissions', () => {
  let service: OrganizationService;
  let authorization: OrganizationAuthorizationService;
  const organizations = [
    { id: 'root', parentId: null, managerId: 'root-manager' },
    { id: 'target', parentId: 'root', managerId: 'local-manager' },
    { id: 'child', parentId: 'target', managerId: null },
    { id: 'other', parentId: null, managerId: 'other-manager' },
  ];
  const tx = {
    organization: {
      findUniqueOrThrow: mockFindUniqueOrThrow,
      findUnique: jest.fn(async ({ where }) => organizations.find(o => o.id === where.id) ?? null),
      findMany: jest.fn(async ({ where }) => organizations.filter(o => o.managerId === where.managerId)),
      create: jest.fn(), update: jest.fn(), delete: jest.fn(),
    },
  };
  const prisma = {
    organization: { findUnique: jest.fn() },
    $transaction: jest.fn(async callback => callback(tx)),
  };
  const auth = { isAdmin: jest.fn(async (actor: string, _client: unknown) => { void _client; return actor === 'admin'; }) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [OrganizationHierarchyService, OrganizationService, OrganizationAuthorizationService,
      { provide: PrismaService, useValue: prisma }, { provide: AuthService, useValue: auth },
    ] }).compile();
    service = module.get(OrganizationService);
    authorization = module.get(OrganizationAuthorizationService);
  });
  beforeEach(() => { jest.clearAllMocks(); });

  it.each([
    ['admin', true], ['root-manager', true], ['local-manager', true],
    ['other-manager', false], ['team-manager', false], ['member', false],
  ] as const)('enforces direct-service update rights for %s', async (actor, allowed) => {
    const result = service.update('target', { name: 'Renamed' }, actor);
    if (allowed) {
      await expect(result).resolves.toBeUndefined();
      expect(tx.organization.update).toHaveBeenCalled();
    } else {
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.organization.update).not.toHaveBeenCalled();
    }
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    for (const call of auth.isAdmin.mock.calls) expect(call[1]).toBe(tx);
  });

  it.each(['create', 'delete'] as const)('protects %s even without a controller', async action => {
    const result = action === 'create' ? service.create({ name: 'New', parentId: 'target' }, 'member') : service.delete('target', 'member');
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.organization[action]).not.toHaveBeenCalled();
  });

  it.each(['root-manager', 'other-manager'])('requires both scopes for a move by %s', async actor => {
    await expect(service.update('target', { parentId: 'other' }, actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.organization.update).not.toHaveBeenCalled();
  });

  it('requires admin to create a root or detach into a root', async () => {
    await expect(service.create({ name: 'Root' }, 'root-manager')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update('target', { parentId: null }, 'root-manager')).rejects.toBeInstanceOf(ForbiddenException);
    await service.create({ name: 'Root' }, 'admin');
    await service.update('target', { parentId: null }, 'admin');
    expect(tx.organization.create).toHaveBeenCalledWith({ data: { name: 'Root' } });
    expect(tx.organization.update).toHaveBeenCalledWith({ where: { id: 'target' }, data: { parentId: null } });
  });

  it('does not require admin to preserve an existing root', async () => {
    await service.update('root', { parentId: null }, 'root-manager');
    expect(tx.organization.update).toHaveBeenCalled();
  });

  it('never trusts a manager nominated in the request', async () => {
    await expect(service.update('target', { managerId: 'member' }, 'member')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.organization.update).not.toHaveBeenCalled();
  });

  it('loads the current scope and permissions again on every call', async () => {
    await service.update('target', { name: 'First' }, 'local-manager');
    const target = organizations.find(o => o.id === 'target')!;
    const original = target.managerId;
    try {
      target.managerId = null;
      await expect(service.update('target', { name: 'Second' }, 'local-manager')).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.organization.update).toHaveBeenCalledTimes(1);
    } finally { target.managerId = original; }
  });

  it('provides tree scopes without changing data', async () => {
    const client = tx as unknown as Parameters<typeof authorization.getTreeRootScope>[2];
    await expect(authorization.getTreeRootScope('admin', undefined, client)).resolves.toEqual({ parentId: null });
    await expect(authorization.getTreeRootScope('admin', 'other', client)).resolves.toEqual({ id: 'other' });
    await expect(authorization.getTreeRootScope('local-manager', undefined, client)).resolves.toEqual({ managerId: 'local-manager' });
    await expect(authorization.getTreeRootScope('member', undefined, client)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.organization.update).not.toHaveBeenCalled();
  });
});
