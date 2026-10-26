import { Prisma } from '../../src/generated/prisma/client';

/** Give an existing nullable lookup mock Prisma's required-lookup behavior. */
export async function mockFindUniqueOrThrow(
  this: { findUnique: jest.Mock },
  args: unknown,
): Promise<unknown> {
  const resource = await this.findUnique(args);
  if (resource == null) {
    throw new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: Prisma.prismaVersion.client,
    });
  }
  return resource;
}
