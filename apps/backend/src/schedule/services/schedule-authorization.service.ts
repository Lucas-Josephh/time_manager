import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class ScheduleAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanCreate(actor: string, tx: Prisma.TransactionClient = this.prisma) {
    const user = await tx.user.findUnique({
      where: { id: actor },
      select: {
        isAdmin: true,
        managedTeams: { take: 1, select: { id: true } },
        managedOrganizations: { take: 1, select: { id: true } },
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
}
