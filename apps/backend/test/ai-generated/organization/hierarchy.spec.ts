import { BadRequestException } from '@nestjs/common';
import { OrganizationService } from '../../../src/organization/organization.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('Organization hierarchy updates', () => {
  const delegate = { findUnique: jest.fn(), update: jest.fn() };
  const prisma = { $transaction: jest.fn(async (callback) => callback({ organization: delegate })) };
  const service = new OrganizationService(prisma as unknown as PrismaService);
  beforeEach(() => { delegate.findUnique.mockReset(); delegate.update.mockReset(); });

  it('rejects a self parent without writing', async () => {
    delegate.findUnique.mockResolvedValue({ id: 'a' });
    await expect(service.update('a', { parentId: 'a' })).rejects.toBeInstanceOf(BadRequestException);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('rejects moving an organization below its descendant', async () => {
    delegate.findUnique.mockResolvedValueOnce({ id: 'a' }).mockResolvedValueOnce({ parentId: 'a' });
    await expect(service.update('a', { parentId: 'child' })).rejects.toMatchObject({ response: { data: { errors: [{ field: 'parentId', messages: ['organization_cycle'] }] } } });
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('rejects a missing parent', async () => {
    delegate.findUnique.mockResolvedValueOnce({ id: 'a' }).mockResolvedValueOnce(null);
    await expect(service.update('a', { parentId: 'missing' })).rejects.toBeInstanceOf(BadRequestException);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('allows detaching a parent and clearing a manager', async () => {
    delegate.findUnique.mockResolvedValue({ id: 'a' });
    delegate.update.mockResolvedValue({ id: 'a', parentId: null, managerId: null });
    await expect(service.update('a', { parentId: null, managerId: null })).resolves.toMatchObject({ parentId: null });
    expect(delegate.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { parentId: null, managerId: null } });
  });
});
