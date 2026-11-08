import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { Prisma } from '../../../src/generated/prisma/client';
import { createHttpTestApp } from '../support/http-test-app';

const future = '2099-01-01T00:00:00+01:00';
const schedule = {
  id: 'schedule',
  name: 'Matin',
  timezone: 'Europe/Paris',
  sourceWorkScheduleId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: {
    id: 'actor',
    firstname: 'Alice',
    lastname: 'Martin',
    email: 'private',
  },
  days: [
    {
      dayOfWeek: 'MONDAY',
      timeSlots: [{ id: 'private', startTime: '09:00', endTime: '17:00' }],
    },
  ],
};
const assignment = {
  id: 'assignment',
  userId: 'target',
  workScheduleId: 'schedule',
  effectiveFrom: new Date(future),
  workSchedule: schedule,
};
const target = {
  id: 'target',
  organizationId: null,
  team: { managerId: 'actor', organizationId: 'org' },
};

describe('Schedule assignment HTTP API', () => {
  let app: INestApplication;
  let authenticated = true;
  let admin = false;
  const prisma = {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    organization: { findUnique: jest.fn() },
    workSchedule: { findUniqueOrThrow: jest.fn() },
    userWorkScheduleAssignment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      createManyAndReturn: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  beforeAll(async () => {
    app = await createHttpTestApp(prisma, async () => {
      if (!authenticated) throw new UnauthorizedException();
      return { user: { id: 'actor' } };
    });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    authenticated = true;
    admin = false;
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.user.findUnique.mockImplementation(async () => ({ isAdmin: admin }));
    prisma.user.findMany.mockResolvedValue([target]);
    prisma.organization.findUnique.mockResolvedValue(null);
    prisma.workSchedule.findUniqueOrThrow.mockResolvedValue(schedule);
    prisma.userWorkScheduleAssignment.findMany.mockResolvedValue([]);
    prisma.userWorkScheduleAssignment.findFirst.mockResolvedValue(null);
    prisma.userWorkScheduleAssignment.count.mockResolvedValue(0);
    prisma.userWorkScheduleAssignment.createManyAndReturn.mockResolvedValue([
      assignment,
    ]);
  });
  const post = (body: object) =>
    request(app.getHttpServer())
      .post('/api/schedule/schedule/assignments')
      .send(body);

  it.each([
    ['post', '/api/schedule/schedule/assignments'],
    ['get', '/api/schedule/users/target/assignments'],
    ['get', '/api/schedule/users/target'],
  ] as const)('requires authentication for %s %s', async (method, path) => {
    authenticated = false;
    await request(app.getHttpServer())[method](path).send({}).expect(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows a team manager to assign the exact schedule and serializes its slots', async () => {
    const response = await post({
      userIds: ['target'],
      effectiveFrom: future,
    }).expect(201);
    expect(
      prisma.userWorkScheduleAssignment.createManyAndReturn,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          {
            userId: 'target',
            workScheduleId: 'schedule',
            effectiveFrom: new Date(future),
          },
        ],
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(response.body.data[0].workSchedule.weeklySchedule.MONDAY).toEqual([
      { startTime: '09:00', endTime: '17:00' },
    ]);
    expect(response.body.data[0].workSchedule).not.toHaveProperty('days');
    expect(response.body.data[0].workSchedule.createdBy).not.toHaveProperty(
      'email',
    );
  });

  it('uses a server instant for immediate assignments without requiring retroactive confirmation', async () => {
    const before = Date.now();
    await post({ userIds: ['target'] }).expect(201);
    const saved =
      prisma.userWorkScheduleAssignment.createManyAndReturn.mock.calls[0][0]
        .data[0].effectiveFrom;
    expect(saved.getTime()).toBeGreaterThanOrEqual(before);
    expect(saved.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('assigns all selected users for administrators', async () => {
    admin = true;
    prisma.user.findMany.mockResolvedValue([
      target,
      { id: 'other', organizationId: null, team: null },
    ]);
    await post({ userIds: ['target', 'other'], effectiveFrom: future }).expect(
      201,
    );
    expect(
      prisma.userWorkScheduleAssignment.createManyAndReturn.mock.calls[0][0]
        .data,
    ).toHaveLength(2);
  });

  it('allows managers of ancestor organizations through the target team', async () => {
    prisma.user.findMany.mockResolvedValue([
      { ...target, team: { managerId: 'other', organizationId: 'child' } },
    ]);
    prisma.organization.findUnique.mockImplementation(async ({ where }) =>
      where.id === 'child'
        ? { id: 'child', parentId: 'parent', managerId: null }
        : { id: 'parent', parentId: null, managerId: 'actor' },
    );
    await post({ userIds: ['target'], effectiveFrom: future }).expect(201);
  });

  it('allows managers through the target direct organization', async () => {
    prisma.user.findMany.mockResolvedValue([
      { ...target, organizationId: 'org', team: null },
    ]);
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org',
      parentId: null,
      managerId: 'actor',
    });
    await post({ userIds: ['target'], effectiveFrom: future }).expect(201);
  });

  it('refuses the entire selection when one target is outside the scope', async () => {
    prisma.user.findMany.mockResolvedValue([
      target,
      { id: 'other', organizationId: null, team: null },
    ]);
    const response = await post({
      userIds: ['target', 'other'],
      effectiveFrom: future,
    }).expect(403);
    expect(response.body).toEqual({
      success: false,
      message: 'schedule_assignment_forbidden',
      data: {
        errors: { 'userIds[1]': { messages: ['outside_management_scope'] } },
      },
    });
    expect(
      prisma.userWorkScheduleAssignment.createManyAndReturn,
    ).not.toHaveBeenCalled();
  });

  it('uses request indexes for every denied user even when database results are reordered', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'outside-2', organizationId: null, team: null },
      target,
      { id: 'outside-1', organizationId: null, team: null },
    ]);
    const response = await post({
      userIds: ['outside-1', 'target', 'outside-2'],
      effectiveFrom: future,
    }).expect(403);
    expect(response.body.data.errors).toEqual({
      'userIds[0]': { messages: ['outside_management_scope'] },
      'userIds[2]': { messages: ['outside_management_scope'] },
    });
    expect(
      prisma.userWorkScheduleAssignment.createManyAndReturn,
    ).not.toHaveBeenCalled();
  });

  it('uses request indexes for missing users in a mixed selection', async () => {
    const response = await post({
      userIds: ['missing-1', 'target', 'missing-2'],
      effectiveFrom: future,
    }).expect(404);
    expect(response.body.data.errors).toEqual({
      'userIds[0]': { messages: ['reference_not_found'] },
      'userIds[2]': { messages: ['reference_not_found'] },
    });
    expect(
      prisma.userWorkScheduleAssignment.createManyAndReturn,
    ).not.toHaveBeenCalled();
  });

  it('uses the original indexes for conflicts and preserves conflict details', async () => {
    admin = true;
    prisma.user.findMany.mockResolvedValue([
      target,
      { id: 'other', organizationId: null, team: null },
    ]);
    prisma.userWorkScheduleAssignment.findMany.mockResolvedValue([
      {
        userId: 'target',
        workScheduleId: 'future-1',
        effectiveFrom: new Date('2099-02-01T00:00:00Z'),
      },
      {
        userId: 'target',
        workScheduleId: 'future-2',
        effectiveFrom: new Date('2099-03-01T00:00:00Z'),
      },
    ]);
    const response = await post({
      userIds: ['other', 'target'],
      effectiveFrom: future,
    }).expect(409);
    expect(response.body.data.errors).toEqual({
      'userIds[1]': { messages: ['later_schedule_assignment_exists'] },
    });
    expect(response.body.data.conflictingAssignments).toHaveLength(2);
    expect(
      prisma.userWorkScheduleAssignment.createManyAndReturn,
    ).not.toHaveBeenCalled();
  });

  it('associates date and confirmation errors with their input names', async () => {
    const invalid = await post({
      userIds: ['target'],
      effectiveFrom: 'invalid',
    }).expect(400);
    expect(invalid.body.data.errors).toEqual({
      effectiveFrom: { messages: ['effective_from_requires_timezone'] },
    });
    const at = await request(app.getHttpServer())
      .get('/api/schedule/users/target?at=invalid')
      .expect(400);
    expect(at.body.data.errors).toEqual({
      at: { messages: ['effective_from_requires_timezone'] },
    });
    const past = { userIds: ['target'], effectiveFrom: '2020-01-01T00:00:00Z' };
    const forbidden = await post(past).expect(403);
    expect(forbidden.body.data.errors).toEqual({
      effectiveFrom: { messages: ['retroactive_assignment_forbidden'] },
    });
    admin = true;
    const confirm = await post(past).expect(400);
    expect(confirm.body.data.errors).toEqual({
      confirmRetroactive: {
        messages: ['retroactive_assignment_confirmation_required'],
      },
    });
  });

  it('returns 404 for a missing user without writing', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const response = await post({
      userIds: ['missing'],
      effectiveFrom: future,
    }).expect(404);
    expect(response.body.data.errors).toEqual({
      'userIds[0]': { messages: ['reference_not_found'] },
    });
    expect(
      prisma.userWorkScheduleAssignment.createManyAndReturn,
    ).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing schedule', async () => {
    prisma.workSchedule.findUniqueOrThrow.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('missing', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );
    await post({ userIds: ['target'], effectiveFrom: future }).expect(404);
    expect(
      prisma.userWorkScheduleAssignment.createManyAndReturn,
    ).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { userIds: [] },
    { userIds: ['target', 'target'] },
    { userIds: [42] },
    { userIds: [''] },
    { userIds: ['target'], effectiveFrom: null },
    { userIds: ['target'], confirmRetroactive: 'true' },
    { userIds: ['target'], extra: true },
  ])('rejects invalid DTOs before a transaction: %p', async (body) => {
    await post(body).expect(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    '2099-01-01',
    '2099-01-01T00:00:00',
    'invalid',
    '2099-02-30T00:00:00Z',
  ])('rejects invalid effectiveFrom %s', async (effectiveFrom) => {
    await post({ userIds: ['target'], effectiveFrom }).expect(400);
    expect(
      prisma.userWorkScheduleAssignment.createManyAndReturn,
    ).not.toHaveBeenCalled();
  });

  it('restricts retroactivity to administrators with explicit confirmation', async () => {
    const body = { userIds: ['target'], effectiveFrom: '2020-01-01T00:00:00Z' };
    await post({ ...body, confirmRetroactive: true }).expect(403);
    admin = true;
    await post(body).expect(400);
    expect(
      prisma.userWorkScheduleAssignment.createManyAndReturn,
    ).not.toHaveBeenCalled();
    await post({ ...body, confirmRetroactive: true }).expect(201);
  });

  it('reports later assignments without creating any assignments', async () => {
    const conflict = {
      userId: 'target',
      workScheduleId: 'other',
      effectiveFrom: new Date('2099-02-01T00:00:00Z'),
    };
    prisma.userWorkScheduleAssignment.findMany.mockResolvedValue([conflict]);
    const response = await post({
      userIds: ['target'],
      effectiveFrom: future,
    }).expect(409);
    expect(response.body.message).toBe('later_schedule_assignment_exists');
    expect(response.body.data.conflictingAssignments[0].userId).toBe('target');
    expect(response.body.data.errors).toEqual({
      'userIds[0]': { messages: ['later_schedule_assignment_exists'] },
    });
    expect(
      prisma.userWorkScheduleAssignment.createManyAndReturn,
    ).not.toHaveBeenCalled();
  });

  it.each([
    ['P2002', 'already_exists'],
    ['P2034', 'concurrent_modification'],
  ])('maps database conflict %s', async (code, message) => {
    prisma.userWorkScheduleAssignment.createManyAndReturn.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', {
        code,
        clientVersion: 'test',
      }),
    );
    const response = await post({
      userIds: ['target'],
      effectiveFrom: future,
    }).expect(409);
    expect(response.body.message).toBe(message);
  });

  it('returns paginated history including future assignments', async () => {
    prisma.userWorkScheduleAssignment.findMany.mockResolvedValue([assignment]);
    prisma.userWorkScheduleAssignment.count.mockResolvedValue(3);
    const response = await request(app.getHttpServer())
      .get('/api/schedule/users/target/assignments?page=2&limit=1')
      .expect(200);
    expect(response.body.data.meta).toEqual({
      total: 3,
      page: 2,
      limit: 1,
      totalPages: 3,
    });
    expect(response.body.data.items[0].id).toBe('assignment');
    expect(prisma.userWorkScheduleAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'target' },
        skip: 1,
        take: 1,
        orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
      }),
    );
  });

  it('selects the latest assignment at or before the requested instant', async () => {
    prisma.userWorkScheduleAssignment.findFirst.mockResolvedValue(assignment);
    const response = await request(app.getHttpServer())
      .get('/api/schedule/users/target')
      .query({ at: future })
      .expect(200);
    expect(response.body.data.assignment.id).toBe('assignment');
    expect(prisma.userWorkScheduleAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'target', effectiveFrom: { lte: new Date(future) } },
        orderBy: { effectiveFrom: 'desc' },
      }),
    );
  });

  it('returns explicit null when no schedule is applicable', async () => {
    await request(app.getHttpServer())
      .get('/api/schedule/users/target')
      .expect(200)
      .expect({
        success: true,
        message: 'request_successful',
        data: { assignment: null },
      });
  });

  it.each([
    '/api/schedule/users/target',
    '/api/schedule/users/target/assignments',
  ])('blocks unauthorized reads of %s', async (path) => {
    prisma.user.findMany.mockResolvedValue([{ ...target, team: null }]);
    const response = await request(app.getHttpServer()).get(path).expect(403);
    expect(response.body.data.errors).toEqual({
      userId: { messages: ['outside_management_scope'] },
    });
    expect(prisma.userWorkScheduleAssignment.findFirst).not.toHaveBeenCalled();
    expect(prisma.userWorkScheduleAssignment.findMany).not.toHaveBeenCalled();
  });

  it('allows reading your own history without management rights', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'actor', organizationId: null, team: null },
    ]);
    await request(app.getHttpServer())
      .get('/api/schedule/users/actor/assignments')
      .expect(200);
  });

  it('validates read query parameters', async () => {
    await request(app.getHttpServer())
      .get('/api/schedule/users/target?at=invalid')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/schedule/users/target/assignments?page=0')
      .expect(400);
  });
});
