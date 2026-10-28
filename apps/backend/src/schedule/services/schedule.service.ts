import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateScheduleDto,
  QueryScheduleDto,
  UpdateScheduleDto,
  WeeklyScheduleDto,
} from '../dto/schedule.dto';
import { DayOfWeek, Prisma, WorkSchedule } from '../../generated/prisma/client';
import { paginate } from '../../common/pagination/paginate';

const weekdays = [
  ['1', DayOfWeek.MONDAY],
  ['2', DayOfWeek.TUESDAY],
  ['3', DayOfWeek.WEDNESDAY],
  ['4', DayOfWeek.THURSDAY],
  ['5', DayOfWeek.FRIDAY],
  ['6', DayOfWeek.SATURDAY],
  ['7', DayOfWeek.SUNDAY],
] as const;

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhereClause(filters: QueryScheduleDto): Prisma.WorkScheduleWhereInput {
    const where: Prisma.WorkScheduleWhereInput = {};
    if (filters.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }
    if (filters.createdByUserId) {
      where.createdByUserId = filters.createdByUserId;
    }
    return where;
  }

  findAll(filters: QueryScheduleDto) {
    const where = this.buildWhereClause(filters);

    return paginate<WorkSchedule>(filters, (range) =>
      this.prisma.$transaction(
        [
          this.prisma.workSchedule.findMany({
            where,
            ...range,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            include: {
              createdBy: {
                select: { id: true, firstname: true, lastname: true },
              },
              versions: {
                orderBy: { version: 'desc' },
                include: {
                  days: {
                    orderBy: { dayOfWeek: 'asc' },
                    include: { timeSlots: { orderBy: { startTime: 'asc' } } },
                  },
                },
              },
            },
          }),
          this.prisma.workSchedule.count({ where }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }

  findOne(id: string) {
    return this.prisma.workSchedule.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            days: {
              orderBy: { dayOfWeek: 'asc' },
              include: { timeSlots: { orderBy: { startTime: 'asc' } } },
            },
          },
        },
      },
    });
  }

  /** Creates a schedule and its initial weekly version atomically. */
  create(dto: CreateScheduleDto, actor: string) {
    return this.prisma.workSchedule.create({
      data: {
        name: dto.name,
        createdByUserId: actor,
        versions: {
          create: {
            createdByUserId: actor,
            days: {
              create: this.buildDays(dto.weeklySchedule),
            },
          },
        },
      },
      include: {
        createdBy: {},
        versions: {
          include: {
            createdBy: {},
            days: {
              orderBy: { dayOfWeek: 'asc' },
              include: { timeSlots: { orderBy: { startTime: 'asc' } } },
            },
          },
        },
      },
    });
  }

  /**
   * Update the schedule name and/or create a new version of the weekly
   * schedule atomically if the weekly schedule is provided in the DTO.
   *
   * @param id
   * @param dto
   */
  async update(id: string, dto: UpdateScheduleDto, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const schedule = await tx.workSchedule.findUniqueOrThrow({
          where: { id },
          select: {
            versions: {
              orderBy: { version: 'desc' },
              take: 1,
              select: { version: true },
            },
          },
        });

        return tx.workSchedule.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.weeklySchedule !== undefined
              ? {
                  versions: {
                    create: {
                      version: (schedule.versions[0]?.version ?? 0) + 1,
                      createdByUserId: actor,
                      days: { create: this.buildDays(dto.weeklySchedule) },
                    },
                  },
                }
              : {}),
          },
          include: {
            versions: {
              orderBy: { version: 'desc' },
              include: {
                days: {
                  orderBy: { dayOfWeek: 'asc' },
                  include: {
                    timeSlots: { orderBy: { startTime: 'asc' } },
                  },
                },
              },
            },
          },
        });
        // This isolation level ensures that the version number is incremented
        // correctly even if multiple updates happen concurrently.
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private buildDays(weeklySchedule: WeeklyScheduleDto) {
    return weekdays.map(([key, dayOfWeek]) => ({
      dayOfWeek,
      timeSlots: {
        create: weeklySchedule[key].map((slot) => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      },
    }));
  }
}
