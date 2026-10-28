import { ScheduleService } from './schedule.service';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';

const prisma = {
  workSchedule: {
    findUnique: jest.fn(),
  },
};

describe('ScheduleService', () => {
  // Before all tests, this callback is called to reset all mocks and not store previous data
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('Return the work schedule by id', async () => {
    const schedule = {
      id: 'schedule-1',
      name: 'test',
    };

    prisma.workSchedule.findUnique.mockResolvedValue(schedule);

    const module = await Test.createTestingModule({
      providers: [
        ScheduleService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    const scheduleService = module.get(ScheduleService);
    await scheduleService.findOne('schedule-1').then((result) => {
      expect(result).toEqual(schedule);
      expect(prisma.workSchedule.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'schedule-1' },
        }),
      );
    });
  });
  it('Return null if the work schedule deos not exists', async () => {
    prisma.workSchedule.findUnique.mockResolvedValue(null);

    const module = await Test.createTestingModule({
      providers: [
        ScheduleService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    const scheduleService = module.get(ScheduleService);
    const schedule = scheduleService.findOne('test');
    await expect(schedule).resolves.toBeNull();
  });
});
