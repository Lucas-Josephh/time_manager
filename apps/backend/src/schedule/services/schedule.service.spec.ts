import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { DayOfWeek, Prisma, WorkSchedule } from '../../generated/prisma/client';
import {
  CreateScheduleDto,
  QueryScheduleDto,
  WeeklyScheduleDto,
} from '../dto/schedule.dto';
import { ScheduleService } from './schedule.service';
import { ScheduleAuthorizationService } from './schedule-authorization.service';

type SchedulePage = Awaited<ReturnType<ScheduleService['findAll']>>;

function makeSchedule(id = 'schedule-1'): WorkSchedule {
  return {
    id,
    name: `Planning ${id}`,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-10-30T09:00:00Z'),
    updatedAt: new Date('2026-10-30T09:00:00Z'),
  };
}

function makeWeek(): WeeklyScheduleDto {
  return {
    '1': [
      { startTime: '09:00', endTime: '12:00' },
      { startTime: '13:00', endTime: '17:00' },
    ],
    '2': [{ startTime: '10:00', endTime: '16:00' }],
    '3': [],
    '4': [],
    '5': [],
    '6': [],
    '7': [],
  };
}

// These are results of database operations, not a real database connection.
const prisma = {
  workSchedule: {
    findUnique: jest.fn<
      Promise<WorkSchedule | null>,
      [Prisma.WorkScheduleFindUniqueArgs]
    >(),
    findMany: jest.fn<
      Promise<WorkSchedule[]>,
      [Prisma.WorkScheduleFindManyArgs]
    >(),
    count: jest.fn<Promise<number>, [Prisma.WorkScheduleCountArgs]>(),
    create: jest.fn<Promise<WorkSchedule>, [Prisma.WorkScheduleCreateArgs]>(),
  },
  $transaction: jest.fn(),
};

const tx = {
  workSchedule: {
    findUniqueOrThrow: jest.fn<
      Promise<{ versions: { version: number }[] }>,
      [Prisma.WorkScheduleFindUniqueOrThrowArgs]
    >(),
    update: jest.fn<Promise<WorkSchedule>, [Prisma.WorkScheduleUpdateArgs]>(),
  },
};

// Explicit expected mapping: tests catch a swapped weekday or a lost time slot.
const expectedDays = [
  {
    dayOfWeek: DayOfWeek.MONDAY,
    timeSlots: {
      create: [
        { startTime: '09:00', endTime: '12:00' },
        { startTime: '13:00', endTime: '17:00' },
      ],
    },
  },
  {
    dayOfWeek: DayOfWeek.TUESDAY,
    timeSlots: { create: [{ startTime: '10:00', endTime: '16:00' }] },
  },
  { dayOfWeek: DayOfWeek.WEDNESDAY, timeSlots: { create: [] } },
  { dayOfWeek: DayOfWeek.THURSDAY, timeSlots: { create: [] } },
  { dayOfWeek: DayOfWeek.FRIDAY, timeSlots: { create: [] } },
  { dayOfWeek: DayOfWeek.SATURDAY, timeSlots: { create: [] } },
  { dayOfWeek: DayOfWeek.SUNDAY, timeSlots: { create: [] } },
];

describe('ScheduleService', () => {
  let service: ScheduleService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ScheduleAuthorizationService,
          useValue: {
            assertCanCreate: jest.fn().mockResolvedValue(undefined),
            assertCanManage: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    service = module.get(ScheduleService);
  });

  describe('findOne', () => {
    it('returns the schedule requested by id', async () => {
      const schedule = makeSchedule();
      prisma.workSchedule.findUnique.mockResolvedValue(schedule);

      const result = await service.findOne(schedule.id);

      expect(result).toEqual(schedule);
      expect(prisma.workSchedule.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: schedule.id } }),
      );
    });

    it('returns null when the schedule does not exist', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).resolves.toBeNull();
    });

    it('propagates database failures', async () => {
      const error = new Error('Database unavailable');
      prisma.workSchedule.findUnique.mockRejectedValue(error);
      await expect(service.findOne('schedule-1')).rejects.toBe(error);
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      // Only simulates the array form of $transaction used by findAll.
      prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      );
      prisma.workSchedule.findMany.mockResolvedValue([]);
      prisma.workSchedule.count.mockResolvedValue(0);
    });

    it('returns schedules with default pagination and deterministic ordering', async () => {
      const schedules = [makeSchedule(), makeSchedule('schedule-2')];
      prisma.workSchedule.findMany.mockResolvedValue(schedules);
      prisma.workSchedule.count.mockResolvedValue(2);

      const result = await service.findAll({});

      const expected = {
        items: schedules,
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      } satisfies SchedulePage;
      expect(result).toEqual(expected);
      expect(prisma.workSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 0,
          take: 10,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
      );
      expect(prisma.workSchedule.count).toHaveBeenCalledWith({ where: {} });
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });
    });

    it('returns an empty page and zero total pages when nothing matches', async () => {
      await expect(service.findAll({})).resolves.toEqual({
        items: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });
    });

    it('applies the requested offset and rounds the number of pages up', async () => {
      prisma.workSchedule.count.mockResolvedValue(21);
      const result = await service.findAll({ page: 2, limit: 10 });
      expect(result.meta).toEqual({
        total: 21,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
      expect(prisma.workSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('preserves the total on a page beyond the last result', async () => {
      prisma.workSchedule.count.mockResolvedValue(2);
      await expect(service.findAll({ page: 3, limit: 10 })).resolves.toEqual({
        items: [],
        meta: { total: 2, page: 3, limit: 10, totalPages: 1 },
      });
    });

    it.each<[string, QueryScheduleDto, Prisma.WorkScheduleWhereInput]>([
      [
        'name',
        { name: 'Matin' },
        { name: { contains: 'Matin', mode: 'insensitive' } },
      ],
      ['creator', { createdByUserId: 'user-2' }, { createdByUserId: 'user-2' }],
      [
        'combined filters',
        { name: 'Matin', createdByUserId: 'user-2' },
        {
          name: { contains: 'Matin', mode: 'insensitive' },
          createdByUserId: 'user-2',
        },
      ],
    ])(
      'applies %s to both the items and the total',
      async (_label, filters, where) => {
        await service.findAll(filters);
        expect(prisma.workSchedule.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where }),
        );
        expect(prisma.workSchedule.count).toHaveBeenCalledWith({ where });
      },
    );

    it('propagates transaction failures', async () => {
      const error = new Error('Read failed');
      prisma.$transaction.mockRejectedValue(error);
      await expect(service.findAll({})).rejects.toBe(error);
    });
  });

  describe('create', () => {
    it('creates the schedule and initial week together with their authenticated creator', async () => {
      const dto: CreateScheduleDto = {
        name: 'Matin',
        weeklySchedule: makeWeek(),
      };
      const created = makeSchedule();
      prisma.workSchedule.create.mockResolvedValue(created);

      const result = await service.create(dto, 'user-1');

      expect(result).toEqual(created);
      expect(prisma.workSchedule.create).toHaveBeenCalledTimes(1);
      expect(prisma.workSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Matin',
            createdByUserId: 'user-1',
            versions: {
              create: {
                createdByUserId: 'user-1',
                days: { create: expectedDays },
              },
            },
          },
        }),
      );
    });

    it('supports a week with no working days', async () => {
      const week: WeeklyScheduleDto = {
        '1': [],
        '2': [],
        '3': [],
        '4': [],
        '5': [],
        '6': [],
        '7': [],
      };
      await service.create({ name: 'Repos', weeklySchedule: week }, 'user-1');
      expect(prisma.workSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            versions: {
              create: {
                createdByUserId: 'user-1',
                days: {
                  create: expectedDays.map((day) => ({
                    ...day,
                    timeSlots: { create: [] },
                  })),
                },
              },
            },
          }),
        }),
      );
    });

    it('propagates creation failures', async () => {
      const error = new Error('Write failed');
      prisma.workSchedule.create.mockRejectedValue(error);
      await expect(
        service.create({ name: 'Matin', weeklySchedule: makeWeek() }, 'user-1'),
      ).rejects.toBe(error);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      // Executes the callback against transaction mocks; does not prove real atomicity.
      prisma.$transaction.mockImplementation(
        (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
      );
      tx.workSchedule.findUniqueOrThrow.mockResolvedValue({
        versions: [{ version: 3 }],
      });
      tx.workSchedule.update.mockResolvedValue(makeSchedule());
    });

    it('renames a schedule without creating a version', async () => {
      const result = await service.update(
        'schedule-1',
        { name: 'Nouveau nom' },
        'user-2',
      );
      expect(result).toEqual(makeSchedule());
      expect(tx.workSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'schedule-1' },
          data: { name: 'Nouveau nom' },
        }),
      );
      expect(tx.workSchedule.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'schedule-1' },
          select: {
            versions: {
              orderBy: { version: 'desc' },
              take: 1,
              select: { version: true },
            },
          },
        }),
      );
    });

    it('creates the next complete version without replacing existing versions', async () => {
      await service.update(
        'schedule-1',
        { weeklySchedule: makeWeek() },
        'user-2',
      );
      expect(tx.workSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            versions: {
              create: {
                version: 4,
                createdByUserId: 'user-2',
                days: { create: expectedDays },
              },
            },
          },
        }),
      );
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    });

    it('can rename and create a version in the same update', async () => {
      await service.update(
        'schedule-1',
        { name: 'Soir', weeklySchedule: makeWeek() },
        'user-2',
      );
      expect(tx.workSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Soir',
            versions: {
              create: {
                version: 4,
                createdByUserId: 'user-2',
                days: { create: expectedDays },
              },
            },
          },
        }),
      );
    });

    it('starts at version 1 if the schedule has no version', async () => {
      tx.workSchedule.findUniqueOrThrow.mockResolvedValue({ versions: [] });
      await service.update(
        'schedule-1',
        { weeklySchedule: makeWeek() },
        'user-2',
      );
      expect(tx.workSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            versions: { create: expect.objectContaining({ version: 1 }) },
          }),
        }),
      );
    });

    it('does not add a version for an empty patch', async () => {
      await service.update('schedule-1', {}, 'user-2');
      expect(tx.workSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: {} }),
      );
    });

    it('does not write if the schedule is missing', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: 'test',
      });
      tx.workSchedule.findUniqueOrThrow.mockRejectedValue(error);
      await expect(
        service.update('missing', { name: 'Matin' }, 'user-2'),
      ).rejects.toBe(error);
      expect(tx.workSchedule.update).not.toHaveBeenCalled();
    });

    it('propagates concurrent write conflicts for the shared error handler', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Conflict', {
        code: 'P2034',
        clientVersion: 'test',
      });
      tx.workSchedule.update.mockRejectedValue(error);
      await expect(
        service.update('schedule-1', { weeklySchedule: makeWeek() }, 'user-2'),
      ).rejects.toBe(error);
    });
  });
});
