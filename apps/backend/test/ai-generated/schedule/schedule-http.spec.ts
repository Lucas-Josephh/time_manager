import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { Prisma } from '../../../src/generated/prisma/client';
import { createHttpTestApp } from '../support/http-test-app';

const weeklySchedule = {
  MONDAY: [{ startTime: '09:00', endTime: '17:00' }],
  TUESDAY: [],
  WEDNESDAY: [],
  THURSDAY: [],
  FRIDAY: [],
  SATURDAY: [],
  SUNDAY: [],
};
const date = new Date('2026-10-30T09:00:00Z');
const schedule = {
  id: 'schedule-1',
  name: 'Matin',
  createdAt: date,
  updatedAt: date,
  createdByUserId: 'actor',
  createdBy: {
    id: 'actor',
    firstname: 'Alice',
    lastname: 'Martin',
    email: 'private@example.com',
  },
  sourceWorkScheduleId: null, timezone: 'Europe/Paris',
  days: [{ id: 'day-1', dayOfWeek: 'MONDAY', timeSlots: [
    { id: 'slot-1', startTime: '09:00', endTime: '17:00', scheduleDayId: 'day-1' },
  ] }],
};

function databaseError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Database error', {
    code,
    clientVersion: 'test',
  });
}

describe('Schedule HTTP API', () => {
  let app: INestApplication;
  let authenticated = true;
  let mustChangePassword = false;
  const prisma = {
    user: { findUnique: jest.fn() },
    workSchedule: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeAll(async () => {
    app = await createHttpTestApp(prisma, async () => {
      if (!authenticated) throw new UnauthorizedException();
      return { user: { id: 'actor', mustChangePassword } };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    authenticated = true;
    mustChangePassword = false;
    prisma.user.findUnique.mockResolvedValue({
      isAdmin: true,
      managedTeams: [],
      managedOrganizations: [],
    });
    prisma.workSchedule.findUnique.mockResolvedValue(schedule);
    prisma.workSchedule.findMany.mockResolvedValue([schedule]);
    prisma.workSchedule.count.mockResolvedValue(1);
    prisma.workSchedule.create.mockResolvedValue(schedule);
    prisma.workSchedule.findUniqueOrThrow.mockResolvedValue({
      ...schedule,
    });
    prisma.workSchedule.update.mockResolvedValue(schedule);
    prisma.$transaction.mockImplementation((operation) =>
      typeof operation === 'function'
        ? operation(prisma)
        : Promise.all(operation),
    );
  });

  const routes = [
    ['get', '/api/schedule'],
    ['get', '/api/schedule/schedule-1'],
    ['post', '/api/schedule'],
    ['patch', '/api/schedule/schedule-1'],
  ] as const;

  it.each(routes)('requires authentication for %s %s', async (method, path) => {
    authenticated = false;
    await request(app.getHttpServer())[method](path).send({}).expect(401);
    expect(prisma.workSchedule.findMany).not.toHaveBeenCalled();
    expect(prisma.workSchedule.findUnique).not.toHaveBeenCalled();
    expect(prisma.workSchedule.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(routes)(
    'requires the temporary password to be changed for %s %s',
    async (method, path) => {
      mustChangePassword = true;
      const response = await request(app.getHttpServer())
        [method](path)
        .send({})
        .expect(403);
      expect(response.body.message).toBe('password_change_required');
    },
  );

  it('serializes schedule relations without exposing internal or private fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/schedule/schedule-1')
      .expect(200);
    expect(response.body).toEqual({
      success: true,
      message: 'request_successful',
      data: {
        id: schedule.id,
        name: schedule.name,
        createdAt: date.toISOString(),
        updatedAt: date.toISOString(),
        createdBy: { id: 'actor', firstname: 'Alice', lastname: 'Martin' },
        sourceWorkScheduleId: null, timezone: 'Europe/Paris',
        weeklySchedule,
      },
    });
  });

  it.each(['/api/schedule/tree', '/api/schedule/schedule-1/tree'])(
    'returns nested descendants for %s', async (path) => {
      const child = { ...schedule, id: 'child', sourceWorkScheduleId: schedule.id };
      const grandchild = { ...schedule, id: 'grandchild', sourceWorkScheduleId: child.id };
      prisma.workSchedule.findMany
        .mockReset()
        .mockImplementation(({ where }) => Promise.resolve(
          [schedule, child, grandchild].filter((item) =>
            where.sourceWorkScheduleId === null
              ? item.sourceWorkScheduleId === null
              : where.sourceWorkScheduleId.in.includes(item.sourceWorkScheduleId),
          ),
        ));
      const response = await request(app.getHttpServer()).get(path).expect(200);
      const roots = response.body.data;
      expect(roots).toHaveLength(1);
      expect(roots[0].id).toBe(schedule.id);
      expect(roots[0].weeklySchedule).toEqual(weeklySchedule);
      expect(roots[0].children[0].id).toBe('child');
      expect(roots[0].children[0].weeklySchedule).toEqual(weeklySchedule);
      expect(roots[0].children[0].children[0]).toMatchObject({ id: 'grandchild', children: [] });
      expect(roots[0]).not.toHaveProperty('days');
    },
  );

  it('returns 404 for a missing subtree root', async () => {
    prisma.workSchedule.findUniqueOrThrow.mockRejectedValue(databaseError('P2025'));
    await request(app.getHttpServer()).get('/api/schedule/missing/tree').expect(404);
  });

  it('returns an empty success envelope for a missing detail, as currently documented', async () => {
    prisma.workSchedule.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/api/schedule/missing')
      .expect(200)
      .expect({ success: true, message: 'request_successful', data: {} });
  });

  it('transforms list filters and returns a paginated envelope', async () => {
    const response = await request(app.getHttpServer())
      .get(
        '/api/schedule?page=2&limit=5&name=%20Matin%20&createdBy=%20actor%20',
      )
      .expect(200);
    expect(response.body.data.meta).toEqual({
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].weeklySchedule).toEqual(weeklySchedule);
    expect(response.body.data.items[0]).not.toHaveProperty('days');
    expect(prisma.workSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: {
          name: { contains: 'Matin', mode: 'insensitive' },
          createdByUserId: 'actor',
        },
      }),
    );
  });

  it.each([
    ['post', '/api/schedule'],
    ['patch', '/api/schedule/schedule-1'],
  ] as const)('points to the exact invalid endTime for %s %s', async (method, path) => {
    const response = await request(app.getHttpServer())[method](path).send({
      name: 'Planning Postman', timezone: 'Europe/Paris',
      weeklySchedule: { ...weeklySchedule, MONDAY: [{ startTime: '09:00', endTime: '08:00' }, { startTime: '13:00', endTime: '17:00' }] },
    }).expect(400);
    expect(response.body).toEqual({ success: false, message: 'validation_failed', data: { errors: {
      'weeklySchedule[MONDAY][0][endTime]': { messages: ['schedule_end_time_must_follow_start_time'] },
    } } });
    expect(prisma.workSchedule.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses the authenticated actor when creating a schedule', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/schedule')
      .send({ name: ' Matin ', weeklySchedule })
      .expect(201);
    expect(response.body.message).toBe('request_successful');
    expect(response.body.data.id).toBe('schedule-1');
    expect(prisma.workSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Matin',
          createdByUserId: 'actor',
          days: { create: expect.any(Array) },
        }),
      }),
    );
  });

  it('forbids creating and updating schedules without management permissions', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isAdmin: false,
      managedTeams: [],
      managedOrganizations: [],
    });
    await request(app.getHttpServer())
      .post('/api/schedule')
      .send({ name: 'Matin', weeklySchedule })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/schedule/schedule-1')
      .send({ name: 'Soir' })
      .expect(403);
    expect(prisma.workSchedule.create).not.toHaveBeenCalled();
    expect(prisma.workSchedule.update).not.toHaveBeenCalled();
  });

  it('creates a successor on update without changing the original', async () => {
    await request(app.getHttpServer()).patch('/api/schedule/schedule-1').send({ weeklySchedule }).expect(200);
    expect(prisma.workSchedule.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      sourceWorkScheduleId: 'schedule-1', createdByUserId: 'actor', days: { create: expect.any(Array) },
    }) }));
    expect(prisma.workSchedule.update).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'Matin', weeklySchedule, createdByUserId: 'forged' },
    { name: 'Matin', weeklySchedule: { MONDAY: [] } },
    { name: '   ', weeklySchedule },
  ])('rejects invalid creation before writing: %p', async (body) => {
    const response = await request(app.getHttpServer())
      .post('/api/schedule')
      .send(body)
      .expect(400);
    expect(response.body.message).toBe('validation_failed');
    expect(prisma.workSchedule.create).not.toHaveBeenCalled();
  });

  it('rejects invalid update and query data before accessing the database', async () => {
    await request(app.getHttpServer())
      .patch('/api/schedule/schedule-1')
      .send({ weeklySchedule: { MONDAY: [] } })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/schedule?limit=101')
      .expect(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('translates missing schedules on update to 404', async () => {
    prisma.workSchedule.findUniqueOrThrow.mockRejectedValue(
      databaseError('P2025'),
    );
    const response = await request(app.getHttpServer())
      .patch('/api/schedule/missing')
      .send({ name: 'Soir' })
      .expect(404);
    expect(response.body.message).toBe('not_found');
    expect(prisma.workSchedule.update).not.toHaveBeenCalled();
  });

  it('translates concurrent update conflicts to 409', async () => {
    prisma.workSchedule.create.mockRejectedValue(databaseError('P2034'));
    const response = await request(app.getHttpServer())
      .patch('/api/schedule/schedule-1')
      .send({ weeklySchedule })
      .expect(409);
    expect(response.body.message).toBe('concurrent_modification');
  });

  it('returns a server error without exposing database details', async () => {
    prisma.workSchedule.findUnique.mockRejectedValue(
      new Error('private database details'),
    );
    const response = await request(app.getHttpServer())
      .get('/api/schedule/schedule-1')
      .expect(500);
    expect(JSON.stringify(response.body)).not.toContain(
      'private database details',
    );
  });
});
