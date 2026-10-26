import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

const PRISMA_ERRORS: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'already_exists' },
  P2003: { status: HttpStatus.CONFLICT, message: 'reference_conflict' },
  P2034: { status: HttpStatus.CONFLICT, message: 'concurrent_modification' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'not_found' },
};

export function mapPrismaException(exception: unknown): unknown {
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
    return exception;
  }
  const mapping = PRISMA_ERRORS[exception.code];
  if (!mapping) return exception;

  return new HttpException(mapping.message, mapping.status);
}
