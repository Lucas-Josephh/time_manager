import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScheduleAssignmentService } from '../../schedule/services/assignment/schedule-assignment.service';
import { ClockService } from './clock.service';

describe('ClockService', () => {
  const startedAt = new Date('2026-11-22T08:00:00Z');
  const endedAt = new Date('2026-11-22T12:00:00Z');
  const openSession = { id: 'session', startedAt, endedAt: null };
  const closedSession = { ...openSession, endedAt };
  const assignmentService = { current: jest.fn() };
  const prisma = {
    workSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  let service: ClockService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ClockService,
        { provide: PrismaService, useValue: prisma },
        { provide: ScheduleAssignmentService, useValue: assignmentService },
      ],
    }).compile();
    service = module.get(ClockService);
    jest.useFakeTimers().setSystemTime(startedAt);
  });

  afterEach(() => jest.useRealTimers());

  it('opens a session against the latest assignment effective at the server time', async () => {
    assignmentService.current.mockResolvedValue({
      assignment: { workScheduleId: 'schedule' },
    });
    prisma.workSession.create.mockResolvedValue(openSession);

    await expect(service.start('employee')).resolves.toEqual({
      session: openSession,
    });
    expect(assignmentService.current).toHaveBeenCalledWith(
      'employee',
      startedAt.toISOString(),
      'employee',
    );
    expect(prisma.workSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 'employee', workScheduleId: 'schedule', startedAt },
      }),
    );
  });

  it('rejects clock-in without a current assignment', async () => {
    assignmentService.current.mockResolvedValue({ assignment: null });

    await expect(service.start('employee')).rejects.toThrow(
      'work_schedule_required',
    );
    expect(prisma.workSession.create).not.toHaveBeenCalled();
  });

  it('reports a concurrent clock-in rejected by the unique index as a conflict', async () => {
    assignmentService.current.mockResolvedValue({
      assignment: { workScheduleId: 'schedule' },
    });
    prisma.workSession.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate', {
        clientVersion: 'test',
        code: 'P2002',
      }),
    );

    await expect(service.start('employee')).rejects.toThrow(
      'work_session_already_open',
    );
  });

  it('scopes the lookup to the employee and prioritizes an open session', async () => {
    prisma.workSession.findFirst.mockResolvedValue(openSession);

    await expect(service.current('employee')).resolves.toEqual({
      session: openSession,
    });
    expect(prisma.workSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'employee' },
        orderBy: expect.arrayContaining([
          { endedAt: { sort: 'desc', nulls: 'first' } },
        ]),
      }),
    );
  });

  it('closes a session using the current server time', async () => {
    const lateDeparture = new Date('2026-11-23T01:00:00Z');
    jest.setSystemTime(lateDeparture);
    prisma.workSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.workSession.findUnique.mockResolvedValue({
      ...openSession,
      endedAt: lateDeparture,
    });

    await expect(service.stop('employee', 'session')).resolves.toEqual({
      session: { ...openSession, endedAt: lateDeparture },
    });
    expect(prisma.workSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session', userId: 'employee', endedAt: null },
      data: { endedAt: lateDeparture },
    });
  });

  it('preserves the original end time on a retried departure', async () => {
    jest.setSystemTime(new Date('2026-11-23T08:00:00Z'));
    prisma.workSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.workSession.findUnique.mockResolvedValue(closedSession);

    await expect(service.stop('employee', 'session')).resolves.toEqual({
      session: closedSession,
    });
    expect(prisma.workSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session', userId: 'employee', endedAt: null },
      data: { endedAt: new Date('2026-11-23T08:00:00Z') },
    });
  });

  it('cannot close or read another employee’s session', async () => {
    prisma.workSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.workSession.findUnique.mockResolvedValue(null);

    await expect(service.stop('other', 'session')).rejects.toThrow(
      'work_session_not_found',
    );
    expect(prisma.workSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session', userId: 'other', endedAt: null },
      }),
    );
    expect(prisma.workSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session', userId: 'other' },
      }),
    );
  });
});
