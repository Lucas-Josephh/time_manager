import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { DayOfWeek, Prisma, WorkSchedule } from '../../generated/prisma/client';
import { QueryScheduleDto, WeeklyScheduleDto } from '../dto/schedule.dto';
import { ScheduleService } from './schedule.service';
import { ScheduleAuthorizationService } from './schedule-authorization.service';

type SchedulePage = Awaited<ReturnType<ScheduleService['findAll']>>;

function makeSchedule(id = 'schedule-1') {
  return {
    id,
    sourceWorkScheduleId: null,
    timezone: 'Europe/Paris',
    createdBy: { id: 'user-1', firstname: 'Alice', lastname: 'Martin' },
    days: [],
    name: `Planning ${id}`,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-10-30T09:00:00Z'),
    updatedAt: new Date('2026-10-30T09:00:00Z'),
  };
}

function makeWeek(): WeeklyScheduleDto {
  return {
    MONDAY: [
      { startTime: '09:00', endTime: '12:00' },
      { startTime: '13:00', endTime: '17:00' },
    ],
    TUESDAY: [{ startTime: '10:00', endTime: '16:00' }],
    WEDNESDAY: [],
    THURSDAY: [],
    FRIDAY: [],
    SATURDAY: [],
    SUNDAY: [],
  };
}

// These are results of database operations, not a real database connection.
const prisma = {
  workSchedule: {
    findUnique: jest.fn<
      Promise<ReturnType<typeof makeSchedule> | null>,
      [Prisma.WorkScheduleFindUniqueArgs]
    >(),
    findMany: jest.fn<
      Promise<ReturnType<typeof makeSchedule>[]>,
      [Prisma.WorkScheduleFindManyArgs]
    >(),
    count: jest.fn<Promise<number>, [Prisma.WorkScheduleCountArgs]>(),
    create: jest.fn<Promise<WorkSchedule>, [Prisma.WorkScheduleCreateArgs]>(),
  },
  $transaction: jest.fn(),
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
    timeSlots: {
      create: [{ startTime: '10:00', endTime: '16:00' }],
    },
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
      ['creator', { createdBy: 'user-2' }, { createdByUserId: 'user-2' }],
      [
        'combined filters',
        { name: 'Matin', createdBy: 'user-2' },
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

  describe('immutable schedules', () => {
    let authorization: { assertCanCreate: jest.Mock };
    beforeEach(() => {
      authorization = {
        assertCanCreate: jest.fn().mockResolvedValue(undefined),
      };
      service = new ScheduleService(
        prisma as unknown as PrismaService,
        authorization as unknown as ScheduleAuthorizationService,
      );
      prisma.$transaction.mockImplementation((operation) => operation(prisma));
      prisma.workSchedule.create.mockResolvedValue(makeSchedule('new'));
    });

    it('creates the full week directly on a new schedule', async () => {
      await service.create(
        { name: 'Matin', weeklySchedule: makeWeek() },
        'user-1',
      );
      expect(prisma.workSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Matin',
            timezone: 'Europe/Paris',
            createdByUserId: 'user-1',
            sourceWorkScheduleId: undefined,
            days: { create: expectedDays },
          },
        }),
      );
    });

    it('rejects unauthorized creation before writing', async () => {
      const error = new Error('Forbidden');
      authorization.assertCanCreate.mockRejectedValue(error);
      await expect(
        service.create({ name: 'Matin', weeklySchedule: makeWeek() }, 'user-1'),
      ).rejects.toBe(error);
      expect(prisma.workSchedule.create).not.toHaveBeenCalled();
    });

    it('creates an independent successor and leaves the source unchanged', async () => {
      const source = {
        ...makeSchedule(),
        days: [
          {
            dayOfWeek: DayOfWeek.MONDAY,
            timeSlots: [
              {
                id: 'slot',
                startTime: '09:00',
                endTime: '17:00',
              },
            ],
          },
        ],
      };
      const findUniqueOrThrow = jest.fn().mockResolvedValue(source);
      Object.assign(prisma.workSchedule, { findUniqueOrThrow });
      const snapshot = JSON.stringify(source);
      const result = await service.update(
        source.id,
        { name: 'Copie' },
        'user-1',
      );
      expect(result.id).toBe('new');
      expect(JSON.stringify(source)).toBe(snapshot);
      expect(prisma.workSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Copie',
            timezone: 'Europe/Paris',
            createdByUserId: 'user-1',
            sourceWorkScheduleId: source.id,
            days: {
              create: [
                {
                  dayOfWeek: DayOfWeek.MONDAY,
                  timeSlots: {
                    create: [
                      {
                        startTime: '09:00',
                        endTime: '17:00',
                      },
                    ],
                  },
                },
              ],
            },
          },
        }),
      );
    });

    it('replaces the full copied week when new hours are supplied', async () => {
      Object.assign(prisma.workSchedule, {
        findUniqueOrThrow: jest.fn().mockResolvedValue(makeSchedule()),
      });
      await service.update(
        'schedule-1',
        { weeklySchedule: makeWeek() },
        'user-1',
      );
      expect(prisma.workSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Planning schedule-1',
            sourceWorkScheduleId: 'schedule-1',
            days: { create: expectedDays },
          }),
        }),
      );
    });

    it('does not create a successor for a missing source', async () => {
      const error = new Error('Missing source');
      Object.assign(prisma.workSchedule, {
        findUniqueOrThrow: jest.fn().mockRejectedValue(error),
      });
      await expect(service.update('missing', {}, 'user-1')).rejects.toBe(error);
      expect(prisma.workSchedule.create).not.toHaveBeenCalled();
    });
  });
});
