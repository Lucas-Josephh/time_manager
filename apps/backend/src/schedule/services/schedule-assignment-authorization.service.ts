import { fieldErrorsResponse } from '../../common/validation/field-errors';
import { FieldErrorsBuilder } from '../../common/validation/field-errors.builder';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { OrganizationHierarchyService } from '../../organization/services/organization-hierarchy.service';

@Injectable()
export class ScheduleAssignmentAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly hierarchy: OrganizationHierarchyService,
  ) {}

  /** Require management rights on every selected user. */
  async assertCanAssign(
    userIds: string[],
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    await this.assertAccess(userIds, actor, tx, 'assign');
  }

  /** Allow personal reads, or require management rights on the target user. */
  async assertCanRead(
    userId: string,
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    await this.assertAccess([userId], actor, tx, 'read');
  }

  private async assertAccess(
    userIds: string[],
    actor: string,
    tx: Prisma.TransactionClient,
    access: 'assign' | 'read',
  ) {
    const isAdmin = await this.auth.isAdmin(actor, tx);

    const users = await tx.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        organizationId: true,
        team: { select: { managerId: true, organizationId: true } },
      },
    });

    const usersById = new Map(users.map((user) => [user.id, user]));
    const missing = new FieldErrorsBuilder();
    const errors = new FieldErrorsBuilder();
    const input = (builder: FieldErrorsBuilder, index: number) =>
      access === 'assign' ? builder.at('userIds', index) : builder.at('userId');

    for (const [index, id] of userIds.entries()) {
      if (!usersById.has(id)) input(missing, index).add('reference_not_found');
    }
    if (missing.hasErrors()) {
      throw new NotFoundException(
        fieldErrorsResponse('not_found', missing.toObject()),
      );
    }

    for (const [index, id] of userIds.entries()) {
      const user = usersById.get(id)!;
      if (
        isAdmin ||
        (access === 'read' && user.id === actor) ||
        user.team?.managerId === actor
      )
        continue;

      const organizationIds = new Set([
        user.organizationId,
        user.team?.organizationId,
      ]);

      let allowed = false;
      for (const id of organizationIds) {
        if (id && (await this.hierarchy.isManagedBy(id, actor, tx))) {
          allowed = true;
          break;
        }
      }

      if (!allowed) input(errors, index).add('outside_management_scope');
    }

    if (errors.hasErrors()) {
      throw new ForbiddenException(
        fieldErrorsResponse('schedule_assignment_forbidden', errors.toObject()),
      );
    }
  }
}
