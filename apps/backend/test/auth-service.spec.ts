import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '../src/generated/prisma/client';
import { createTestAuthService } from './support/auth-service';

describe('AuthService.isAdmin', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const auth = createTestAuthService(prisma);

  beforeEach(() => jest.resetAllMocks());

  it.each([true, false])('returns the current admin flag (%s)', async isAdmin => {
    prisma.user.findUnique.mockResolvedValue({ isAdmin });
    await expect(auth.isAdmin('user')).resolves.toBe(isAdmin);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user' }, select: { isAdmin: true },
    });
  });

  it('rejects a user who no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(auth.isAdmin('missing')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reads from the transaction instead of the global client', async () => {
    const tx = { user: { findUnique: jest.fn().mockResolvedValue({ isAdmin: false }) } };
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    await expect(auth.isAdmin('user', tx as unknown as Pick<Prisma.TransactionClient, 'user'>))
      .resolves.toBe(false);
    expect(tx.user.findUnique).toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
