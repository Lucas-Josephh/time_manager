import { OrganizationHierarchyService } from '../../../src/organization/services/organization-hierarchy.service';
import { Test } from '@nestjs/testing';
import { AuthService } from '../../../src/auth/auth.service';
import { OrganizationAuthorizationService } from '../../../src/organization/services/organization-authorization.service';
import { mockFindUniqueOrThrow } from '../../support/mock-find-unique-or-throw';
import { BadRequestException } from '@nestjs/common';
import { OrganizationService } from '../../../src/organization/services/organization.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('Organization hierarchy updates', () => {
  const delegate = { findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(), update: jest.fn() };
  const prisma = { $transaction: jest.fn(async (callback) => callback({ organization: delegate })) };
  let service: OrganizationService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [OrganizationHierarchyService,
      OrganizationService, OrganizationAuthorizationService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuthService, useValue: { isAdmin: jest.fn(async () => true) } },
    ] }).compile();
    service = module.get(OrganizationService);
  });
  beforeEach(() => { delegate.findUnique.mockReset(); delegate.update.mockReset(); });

  it('rejects a self parent without writing', async () => {
    delegate.findUnique.mockResolvedValue({ id: 'a' });
    await expect(service.update('a', { parentId: 'a' }, 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('rejects moving an organization below its descendant', async () => {
    delegate.findUnique.mockResolvedValueOnce({ id: 'a' }).mockResolvedValueOnce({ parentId: 'a' });
    await expect(service.update('a', { parentId: 'child' }, 'admin')).rejects.toMatchObject({ response: { data: { errors: [{ field: 'parentId', messages: ['organization_cycle'] }] } } });
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('rejects a missing parent', async () => {
    delegate.findUnique.mockResolvedValueOnce({ id: 'a' }).mockResolvedValueOnce(null);
    await expect(service.update('a', { parentId: 'missing' }, 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('allows detaching a parent and clearing a manager', async () => {
    delegate.findUnique.mockResolvedValue({ id: 'a' });
    delegate.update.mockResolvedValue({ id: 'a', parentId: null, managerId: null });
    await expect(service.update('a', { parentId: null, managerId: null }, 'admin')).resolves.toMatchObject({ parentId: null });
    expect(delegate.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { parentId: null, managerId: null } });
  });
});
