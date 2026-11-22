import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScheduleAssignmentAuthorizationService } from './schedule-assignment-authorization.service';
import {
  AssignScheduleDto,
  ScheduleAssignedUsersQueryDto,
  ScheduleAssignmentQueryDto,
} from '../../dto/schedule-assignment.dto';
import { ScheduleAssignmentPolicyService } from './schedule-assignment-policy.service';
import { scheduleDetails } from '../../schedule.include';
import { paginate } from '../../../common/pagination/paginate';

const assignmentDetails = {
  workSchedule: { include: scheduleDetails },
} satisfies Prisma.UserWorkScheduleAssignmentInclude;

@Injectable()
export class ScheduleAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: ScheduleAssignmentPolicyService,
    private readonly authorization: ScheduleAssignmentAuthorizationService,
  ) {}

  /** Validate the whole selection before creating assignments in one transaction. */
  assign(scheduleId: string, dto: AssignScheduleDto, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.authorization.assertCanAssign(dto.userIds, actor, tx);
        await tx.workSchedule.findUniqueOrThrow({
          where: { id: scheduleId },
          select: { id: true },
        });
        const now = new Date();
        const effectiveFrom = dto.effectiveFrom ?? now.toISOString();
        await this.policy.assertEffectiveFrom(
          effectiveFrom,
          actor,
          dto.confirmRetroactive ?? false,
          tx,
          now,
        );
        await this.policy.assertNoLaterAssignments(
          dto.userIds,
          effectiveFrom,
          tx,
        );
        return tx.userWorkScheduleAssignment.createManyAndReturn({
          data: dto.userIds.map((userId) => ({
            userId,
            workScheduleId: scheduleId,
            effectiveFrom: new Date(effectiveFrom),
          })),
          include: assignmentDetails,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Return users whose latest effective assignment targets this exact schedule. */
  assignedUsers(
    scheduleId: string,
    query: ScheduleAssignedUsersQueryDto,
    actor: string,
  ) {
    const at =
      query.at === undefined
        ? new Date()
        : this.policy.parseEffectiveFrom(query.at, 'at');
    return this.prisma.$transaction(
      async (tx) => {
        await tx.workSchedule.findUniqueOrThrow({
          where: { id: scheduleId },
          select: { id: true },
        });
        const scope = await this.authorization.readableUsersWhere(actor, tx);
        const assigned = await tx.$queryRaw<{ userId: string }[]>(Prisma.sql`
        SELECT a."userId" FROM "user_work_schedule_assignment" a
        WHERE a."workScheduleId" = ${scheduleId} AND a."effectiveFrom" <= ${at}
          AND NOT EXISTS (
            SELECT 1 FROM "user_work_schedule_assignment" later
            WHERE later."userId" = a."userId"
              AND later."effectiveFrom" > a."effectiveFrom"
              AND later."effectiveFrom" <= ${at}
          )
      `);
        const where: Prisma.UserWhereInput = {
          AND: [scope, { id: { in: assigned.map(({ userId }) => userId) } }],
        };
        return paginate(query, async (range) => {
          const items = await tx.user.findMany({
            where,
            ...range,
            select: { id: true, firstname: true, lastname: true },
            orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }, { id: 'asc' }],
          });
          const total = await tx.user.count({ where });
          return [items, total];
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Read the history and its total from the same database snapshot. */
  history(userId: string, query: ScheduleAssignmentQueryDto, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.authorization.assertCanRead(userId, actor, tx);
        return paginate(query, async (range) => {
          const items = await tx.userWorkScheduleAssignment.findMany({
            where: { userId },
            ...range,
            include: assignmentDetails,
            orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
          });
          const total = await tx.userWorkScheduleAssignment.count({
            where: { userId },
          });
          return [items, total];
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Find the latest assignment that has taken effect, including the boundary. */
  current(userId: string, at: string | undefined, actor: string) {
    const date =
      at === undefined ? new Date() : this.policy.parseEffectiveFrom(at, 'at');
    return this.prisma.$transaction(
      async (tx) => {
        await this.authorization.assertCanRead(userId, actor, tx);
        const assignment = await tx.userWorkScheduleAssignment.findFirst({
          where: { userId, effectiveFrom: { lte: date } },
          orderBy: { effectiveFrom: 'desc' },
          include: assignmentDetails,
        });
        return { assignment };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
