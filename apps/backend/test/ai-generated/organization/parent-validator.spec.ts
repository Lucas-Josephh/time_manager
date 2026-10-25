import type { Prisma } from '../../../src/generated/prisma/client';
import { OrganizationHierarchy } from '../../../src/organization/organization-hierarchy';

describe('Organization parent checks', () => {
  const findParent = jest.fn();
  const prisma = { organization: { findUnique: findParent } } as unknown as Pick<Prisma.TransactionClient, 'organization'>;
  const hierarchy = new OrganizationHierarchy(prisma);
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
});
