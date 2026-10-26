import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import { createAuth } from '../lib/auth';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  readonly auth: ReturnType<typeof createAuth>;

  constructor(private readonly prisma: PrismaService, config: ConfigService) {
    this.auth = createAuth(prisma, config);
  }

  /** Use the transaction client when checking permissions inside a transaction. */
  async isAdmin(
    userId: string,
    prisma: Pick<Prisma.TransactionClient, 'user'> = this.prisma,
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user)
      throw new ForbiddenException();

    return user.isAdmin;
  }

  /**
   * Gets the current session from the request headers.
   *
   * @param headers
   */
  async getSession(headers: IncomingHttpHeaders) {
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(headers),
    });

    if (!session)
      throw new UnauthorizedException();

    return session;
  }
}
