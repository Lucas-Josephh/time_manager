import { FieldErrorsBuilder } from '../../common/validation/field-errors.builder';
import { fieldErrorsResponse } from '../../common/validation/field-errors';
import { isISO8601 } from 'class-validator';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Date and conflict checks shared by schedule assignment operations. */
@Injectable()
export class ScheduleAssignmentPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Assert that the effectiveFrom date is valid and that
   * the user has permission to create a retroactive assignment.
   *
   * @param effectiveFrom
   * @param actor
   * @param confirmRetroactive
   * @param tx
   * @param now
   */
  async assertEffectiveFrom(
    effectiveFrom: string,
    actor: string,
    confirmRetroactive: boolean,
    tx: Prisma.TransactionClient = this.prisma,
    now = new Date(),
  ): Promise<void> {
    const date = this.parseEffectiveFrom(effectiveFrom);
    const isRetroactive = date < now;

    if (!isRetroactive) {
      return;
    }

    const user = await tx.user.findUnique({
      where: { id: actor },
      select: { isAdmin: true },
    });
    if (!user || !user.isAdmin) {
      throw new ForbiddenException(
        fieldErrorsResponse(
          'retroactive_assignment_forbidden',
          new FieldErrorsBuilder().add(
            'effectiveFrom',
            'retroactive_assignment_forbidden',
          ),
        ),
      );
    }

    if (!confirmRetroactive) {
      throw new BadRequestException(
        fieldErrorsResponse(
          'retroactive_assignment_confirmation_required',
          new FieldErrorsBuilder().add(
            'confirmRetroactive',
            'retroactive_assignment_confirmation_required',
          ),
        ),
      );
    }
  }

  /**
   * Call after checking permissions, within the assignment transaction.
   * Reject the entire selection if a member has a later assignment scheduled.
   * This prevents the new schedule from being replaced at an unexpected date.
   */
  async assertNoLaterAssignments(
    userIds: string[],
    effectiveFrom: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const date = this.parseEffectiveFrom(effectiveFrom);

    if (userIds.length === 0) {
      return;
    }

    const conflictingAssignments = await tx.userWorkScheduleAssignment.findMany(
      {
        where: {
          userId: { in: userIds },
          effectiveFrom: { gt: date },
        },
        select: {
          userId: true,
          effectiveFrom: true,
          workScheduleId: true,
        },
        orderBy: [{ effectiveFrom: 'asc' }, { userId: 'asc' }],
      },
    );

    if (conflictingAssignments.length > 0) {
      const conflictingUserIds = new Set(
        conflictingAssignments.map(({ userId }) => userId),
      );
      const errors = new FieldErrorsBuilder();
      for (const [index, id] of userIds.entries()) {
        if (conflictingUserIds.has(id))
          errors.at('userIds', index).add('later_schedule_assignment_exists');
      }
      throw new ConflictException(
        fieldErrorsResponse('later_schedule_assignment_exists', errors, {
          conflictingAssignments,
        }),
      );
    }
  }

  /** Accept a complete date, for example 2026-12-01T00:00:00+01:00. */
  parseEffectiveFrom(value: string, field = 'effectiveFrom'): Date {
    const hasTime = value.includes('T');
    const hasTimezone = value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value);

    if (!hasTime || !hasTimezone) {
      throw new BadRequestException(
        fieldErrorsResponse(
          'effective_from_requires_timezone',
          new FieldErrorsBuilder().add(
            field,
            'effective_from_requires_timezone',
          ),
        ),
      );
    }

    const isValidDate = isISO8601(value, {
      strict: true,
      strictSeparator: true,
    });

    if (!isValidDate) {
      throw new BadRequestException(
        fieldErrorsResponse(
          'invalid_effective_from',
          new FieldErrorsBuilder().add(field, 'invalid_effective_from'),
        ),
      );
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        fieldErrorsResponse(
          'invalid_effective_from',
          new FieldErrorsBuilder().add(field, 'invalid_effective_from'),
        ),
      );
    }

    return date;
  }
}
