import { ScheduleAssignmentService } from './schedule-assignment.service';
import { ScheduleAssignmentPolicyService } from './schedule-assignment-policy.service';
import { ScheduleAssignmentAuthorizationService } from './schedule-assignment-authorization.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';

describe('Schedule assigned users', () => {
  const tx = {
    workSchedule: { findUniqueOrThrow: jest.fn() },
    user: { findMany: jest.fn(), count: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const authorization = { readableUsersWhere: jest.fn() };
  const policy = new ScheduleAssignmentPolicyService(
    tx as unknown as PrismaService,
  );
  const service = new ScheduleAssignmentService(
    tx as unknown as PrismaService,
    policy,
    authorization as unknown as ScheduleAssignmentAuthorizationService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    tx.$transaction.mockImplementation((fn) => fn(tx));
    tx.workSchedule.findUniqueOrThrow.mockResolvedValue({ id: 'schedule' });
    tx.$queryRaw.mockResolvedValue([{ userId: 'user' }]);
    tx.user.findMany.mockResolvedValue([
      { id: 'user', firstname: 'Alice', lastname: 'Martin' },
    ]);
    tx.user.count.mockResolvedValue(1);
    authorization.readableUsersWhere.mockResolvedValue({ id: 'actor' });
  });
  it('applies visibility before pagination and counts the same filtered users', async () => {
    const result = await service.assignedUsers(
      'schedule',
      {
        at: '2026-12-01T00:00:00+01:00',
        page: 2,
        limit: 5,
      },
      'actor',
    );
    const where = { AND: [{ id: 'actor' }, { id: { in: ['user'] } }] };
    expect(tx.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 5, take: 5 }),
    );
    expect(tx.user.count).toHaveBeenCalledWith({ where });
    expect(result.meta).toEqual({ total: 1, page: 2, limit: 5, totalPages: 1 });
    const sql = tx.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.values).toEqual([
      'schedule',
      new Date('2026-11-30T23:00:00Z'),
      new Date('2026-11-30T23:00:00Z'),
    ]);
    expect(sql.sql).toContain('NOT EXISTS');
  });
  it('returns an empty page when nobody matches', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    tx.user.findMany.mockResolvedValue([]);
    tx.user.count.mockResolvedValue(0);
    expect(await service.assignedUsers('schedule', {}, 'actor')).toEqual({
      items: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });
  it('rejects a date without a timezone before reading the database', async () => {
    expect(() =>
      service.assignedUsers('schedule', { at: '2026-12-01' }, 'actor'),
    ).toThrow();
    expect(tx.$transaction).not.toHaveBeenCalled();
  });
  it('fails for a missing schedule before listing users', async () => {
    tx.workSchedule.findUniqueOrThrow.mockRejectedValue(new Error('missing'));
    await expect(service.assignedUsers('missing', {}, 'actor')).rejects.toThrow(
      'missing',
    );
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
