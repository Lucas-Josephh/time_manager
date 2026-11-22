import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScheduleAssignmentService } from '../../schedule/services/assignment/schedule-assignment.service';

const sessionFields = {
  id: true,
  startedAt: true,
  endedAt: true,
} satisfies Prisma.WorkSessionSelect;

@Injectable()
export class ClockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentService: ScheduleAssignmentService,
  ) {}

  async current(userId: string) {
    const session = await this.prisma.workSession.findFirst({
      where: { userId },
      orderBy: [
        { endedAt: { sort: 'desc', nulls: 'first' } },
        { startedAt: 'desc' },
        { id: 'desc' },
      ],
      select: sessionFields,
    });
    return { session };
  }

  async start(userId: string) {
    const startedAt = new Date();
    const { assignment } = await this.assignmentService.current(
      userId,
      startedAt.toISOString(),
      userId,
    );

    if (!assignment) {
      throw new ConflictException('work_schedule_required');
    }

    try {
      const session = await this.prisma.workSession.create({
        data: { userId, startedAt, workScheduleId: assignment.workScheduleId },
        select: sessionFields,
      });
      return { session };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('work_session_already_open');
      }
      throw error;
    }
  }

  async stop(userId: string, id: string) {
    await this.prisma.workSession.updateMany({
      where: { id, userId, endedAt: null },
      data: { endedAt: new Date() },
    });

    const session = await this.prisma.workSession.findUnique({
      where: { id, userId },
      select: sessionFields,
    });

    if (!session) {
      throw new NotFoundException('work_session_not_found');
    }

    return { session };
  }
}
