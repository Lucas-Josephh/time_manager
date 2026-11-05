import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class ScheduleAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Asserts that the given actor can create a schedule.
   *
   * @param actor
   * @param tx
   */
  async assertCanCreate(
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const user = await tx.user.findUnique({
      where: { id: actor },
      select: {
        isAdmin: true,
        managedTeams: {
          take: 1,
          select: { id: true },
        },
        managedOrganizations: {
          take: 1,
          select: { id: true },
        },
      },
    });

    if (
      user &&
      (user.isAdmin ||
        user.managedTeams.length > 0 ||
        user.managedOrganizations.length > 0)
    ) {
      return;
    }

    throw new ForbiddenException();
  }

  /**
   * Asserts that the given actor can manage the specified schedule.
   *
   * @param actor
   * @param scheduleId
   * @param tx
   */
  async assertCanManage(
    actor: string,
    scheduleId: string,
    tx: Prisma.TransactionClient,
  ) {
    if (await this.auth.isAdmin(actor)) return;

    const user = await tx.user.findUnique({
      where: {
        id: actor,
      },
      select: {
        managedTeams: {
          where: {
            workScheduleAssignments: {
              some: { workScheduleId: scheduleId },
            },
          },
          select: { id: true },
          take: 1,
        },
        managedOrganizations: {
          where: {
            workScheduleAssignments: {
              some: { workScheduleId: scheduleId },
            },
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!user) throw new ForbiddenException();

    if (user.managedOrganizations.length > 0) return;

    if (user.managedTeams.length > 0) return;

    throw new ForbiddenException();
  }
}
