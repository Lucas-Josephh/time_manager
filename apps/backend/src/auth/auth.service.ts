import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import { createAuth } from '../lib/auth';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  readonly auth: ReturnType<typeof createAuth>;

  constructor(prisma: PrismaService, config: ConfigService) {
    this.auth = createAuth(prisma, config);
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
