import { checkOrganizationParent } from '../../../src/organization/organization-hierarchy';

describe('Organization parent checks', () => {
  const findParent = jest.fn();
  beforeEach(() => findParent.mockReset());

  it('rejects a self parent without querying the database', async () => {
    await expect(checkOrganizationParent('a', 'a', findParent)).resolves.toBe('cycle');
    expect(findParent).not.toHaveBeenCalled();
  });

  it.each([null, undefined])('accepts no parent: %s', async (parentId) => {
    await expect(checkOrganizationParent('a', parentId, findParent)).resolves.toBe('valid');
    expect(findParent).not.toHaveBeenCalled();
  });

  it('reports a missing ancestor', async () => {
    findParent.mockResolvedValue(null);
    await expect(checkOrganizationParent('a', 'missing', findParent)).resolves.toBe('missing');
  });

  it('stops on an already cyclic ancestor chain', async () => {
    findParent.mockImplementation(async (id) => ({ parentId: id === 'b' ? 'c' : 'b' }));
    await expect(checkOrganizationParent('a', 'b', findParent)).resolves.toBe('cycle');
    expect(findParent).toHaveBeenCalledTimes(2);
  });

  it('propagates database outages', async () => {
    findParent.mockRejectedValue(new Error('Database unavailable'));
    await expect(checkOrganizationParent('a', 'b', findParent)).rejects.toThrow('Database unavailable');
  });
});
