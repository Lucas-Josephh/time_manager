import { SCHEDULE_DAYS, createEmptyWeek } from '../schedule-week';
import { scheduleDetails } from '../schedule.include';
import { assertValidSchedule } from '../schedule-validation';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateScheduleDto,
  QueryScheduleDto,
  UpdateScheduleDto,
  WeeklyScheduleDto,
  ScheduleTimeSlotDto,
} from '../dto/schedule.dto';
import { Prisma } from '../../generated/prisma/client';
import { paginate } from '../../common/pagination/paginate';
import { ScheduleAuthorizationService } from './schedule-authorization.service';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: ScheduleAuthorizationService,
  ) {}

  findAll(filters: QueryScheduleDto) {
    const where: Prisma.WorkScheduleWhereInput = {};
    if (filters.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }
    if (filters.createdBy) {
      where.createdByUserId = filters.createdBy;
    }

    return paginate(filters, (range) =>
      this.prisma.$transaction(
        [
          this.prisma.workSchedule.findMany({
            where,
            ...range,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            include: scheduleDetails,
          }),
          this.prisma.workSchedule.count({ where }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }

  /** Return roots (or a selected schedule) with all their descendants. */
  tree(rootId?: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const roots = rootId
          ? [
              await tx.workSchedule.findUniqueOrThrow({
                where: { id: rootId },
                include: scheduleDetails,
              }),
            ]
          : await tx.workSchedule.findMany({
              where: { sourceWorkScheduleId: null },
              orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
              include: scheduleDetails,
            });
        type Node = (typeof roots)[number] & { children: Node[] };
        const result: Node[] = roots.map((root) => ({ ...root, children: [] }));
        const visited = new Set(result.map((root) => root.id));
        let level = result;
        while (level.length > 0) {
          const parents = new Map(level.map((node) => [node.id, node]));
          const children = await tx.workSchedule.findMany({
            where: { sourceWorkScheduleId: { in: [...parents.keys()] } },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            include: scheduleDetails,
          });
          const next: Node[] = [];
          for (const child of children) {
            if (visited.has(child.id)) continue;
            const parent = parents.get(child.sourceWorkScheduleId!);
            if (!parent) continue;
            visited.add(child.id);
            const node: Node = { ...child, children: [] };
            parent.children.push(node);
            next.push(node);
          }
          level = next;
        }
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  findOne(id: string) {
    return this.prisma.workSchedule.findUnique({
      where: { id },
      include: scheduleDetails,
    });
  }

  create(dto: CreateScheduleDto, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.authorization.assertCanCreate(actor, tx);
        assertValidSchedule(dto.weeklySchedule, dto.timezone ?? 'Europe/Paris');
        return this.persist(tx, dto, actor);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** A modification creates an independent successor; the original never changes. */
  update(id: string, dto: UpdateScheduleDto, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.authorization.assertCanCreate(actor, tx);

        const source = await tx.workSchedule.findUniqueOrThrow({
          where: { id },
          include: scheduleDetails,
        });

        const timezone = dto.timezone ?? source.timezone;
        let week = dto.weeklySchedule;
        if (!week) {
          week = createEmptyWeek<ScheduleTimeSlotDto>();
          for (const day of source.days) {
            week[day.dayOfWeek] = day.timeSlots;
          }
        }

        assertValidSchedule(week, timezone);

        const days = dto.weeklySchedule
          ? this.buildDays(dto.weeklySchedule)
          : source.days.map((day) => ({
              dayOfWeek: day.dayOfWeek,
              timeSlots: {
                create: day.timeSlots.map((slot) => ({
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                })),
              },
            }));
        return this.persist(
          tx,
          { ...dto, timezone },
          actor,
          id,
          dto.name ?? source.name,
          days,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async persist(
    tx: Prisma.TransactionClient,
    dto: UpdateScheduleDto,
    actor: string,
    sourceWorkScheduleId?: string,
    name = dto.name!,
    days = this.buildDays(dto.weeklySchedule!),
  ) {
    return tx.workSchedule.create({
      data: {
        name,
        timezone: dto.timezone ?? 'Europe/Paris',
        createdByUserId: actor,
        sourceWorkScheduleId,
        days: { create: days },
      },
      include: scheduleDetails,
    });
  }

  private buildDays(week: WeeklyScheduleDto) {
    return SCHEDULE_DAYS.map((dayOfWeek) => ({
      dayOfWeek,
      timeSlots: {
        create: week[dayOfWeek].map((slot) => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      },
    }));
  }
}
