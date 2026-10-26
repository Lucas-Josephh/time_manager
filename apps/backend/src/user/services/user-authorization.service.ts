import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

@Injectable()
export class UserAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Require an existing administrator; throw ForbiddenException otherwise.
   *
   * @param actor - ID of the administrator performing the operation.
   * @param client - Database client; pass the current transaction client for transactional checks.
   */
  private async assertAdmin(actor: string, client: Prisma.TransactionClient) {
    // Read the persisted role through the supplied client rather than trusting session data.
    if (!(await this.auth.isAdmin(actor, client)))
      throw new ForbiddenException();
  }

  /**
   * Check whether the actor can create users.
   *
   * @param actor - ID of the administrator performing the operation.
   * @param client - Database client; pass the current transaction client for transactional checks.
   */
  async assertCanCreate(
    actor: string,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    // User administration currently requires admin rights for this action.
    await this.assertAdmin(actor, client);
  }

  /**
   * Check whether the actor can list users or read a user profile.
   *
   * @param actor - ID of the administrator performing the operation.
   * @param client - Database client; pass the current transaction client for transactional checks.
   */
  async assertCanRead(
    actor: string,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    // User administration currently requires admin rights for this action.
    await this.assertAdmin(actor, client);
  }

  /**
   * Check whether the actor can modify user profiles and administrative privileges.
   *
   * @param actor - ID of the administrator performing the operation.
   * @param client - Database client; pass the current transaction client for transactional checks.
   */
  async assertCanUpdate(
    actor: string,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    // User administration currently requires admin rights for this action.
    await this.assertAdmin(actor, client);
  }

  /**
   * Check whether the actor can delete users.
   *
   * @param actor - ID of the administrator performing the operation.
   * @param client - Database client; pass the current transaction client for transactional checks.
   */
  async assertCanDelete(
    actor: string,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    // User administration currently requires admin rights for this action.
    await this.assertAdmin(actor, client);
  }
}
