import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { OrganizationHierarchyService } from '../../../src/organization/services/organization-hierarchy.service';

describe('Organization parent checks', () => {
  const findParent = jest.fn();
  const prisma = { organization: { findUnique: findParent } };
  let hierarchy: OrganizationHierarchyService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [
      OrganizationHierarchyService, { provide: PrismaService, useValue: prisma },
    ] }).compile();
    hierarchy = module.get(OrganizationHierarchyService);
  });
  beforeEach(() => findParent.mockReset());

  it('rejects a self parent without querying the database', async () => {
    await expect(hierarchy.validateOrganizationHierarchy('a', 'a')).resolves.toBe('cycle');
    expect(findParent).not.toHaveBeenCalled();
  });

  it.each([null, undefined])('accepts no parent: %s', async (parentId) => {
    await expect(hierarchy.validateOrganizationHierarchy('a', parentId)).resolves.toBe('valid');
    expect(findParent).not.toHaveBeenCalled();
  });

  it('reports a missing ancestor', async () => {
    findParent.mockResolvedValue(null);
    await expect(hierarchy.validateOrganizationHierarchy('a', 'missing')).resolves.toBe('missing');
  });

  it('stops on an already cyclic ancestor chain', async () => {
    findParent.mockImplementation(async ({ where: { id } }) => ({ parentId: id === 'b' ? 'c' : 'b' }));
    await expect(hierarchy.validateOrganizationHierarchy('a', 'b')).resolves.toBe('cycle');
    expect(findParent).toHaveBeenCalledTimes(2);
  });

  it('propagates database outages', async () => {
    findParent.mockRejectedValue(new Error('Database unavailable'));
    await expect(hierarchy.validateOrganizationHierarchy('a', 'b')).rejects.toThrow('Database unavailable');
  });
  it('keeps concurrent transaction clients isolated and preserves the default client', async () => {
    const first = { organization: { findUnique: jest.fn(async () => ({ id: 'root', parentId: null, managerId: 'first' })) } };
    const second = { organization: { findUnique: jest.fn(async () => ({ id: 'root', parentId: null, managerId: 'second' })) } };
    type Client = Parameters<OrganizationHierarchyService['isManagedBy']>[2];
    await expect(Promise.all([
      hierarchy.isManagedBy('root', 'first', first as unknown as Client),
      hierarchy.isManagedBy('root', 'first', second as unknown as Client),
    ])).resolves.toEqual([true, false]);
    expect(findParent).not.toHaveBeenCalled();
    findParent.mockResolvedValue({ id: 'root', parentId: null, managerId: 'default' });
    await expect(hierarchy.isManagedBy('root', 'default')).resolves.toBe(true);
    expect(first.organization.findUnique).toHaveBeenCalledTimes(1);
    expect(second.organization.findUnique).toHaveBeenCalledTimes(1);
  });

});
