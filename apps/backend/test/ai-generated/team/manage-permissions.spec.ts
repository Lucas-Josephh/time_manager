import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team management permissions', () => {
  const context = useTeamFixture();
  const { prisma, dto, team } = context;
  function actor(managed: string[], isAdmin = false) {
    prisma.user.findUnique.mockResolvedValue({ id: 'test-user', isAdmin });
    const parents: Record<string, string | null> = {
      'department-it': 'parent',
      parent: 'root',
      root: null,
      destination: null,
    };
    prisma.organization.findUnique.mockImplementation(async ({ where }) =>
      where.id in parents
        ? {
            id: where.id,
            parentId: parents[where.id],
            managerId: managed.includes(where.id) ? 'test-user' : null,
          }
        : null,
    );
  }

  it.each(['patch', 'delete'] as const)(
    'allows local and ancestor managers and administrators on %s',
    async (method) => {
      for (const [managed, admin] of [
        [['department-it'], false],
        [['parent'], false],
        [['root'], false],
        [[], true],
      ] as [string[], boolean][]) {
        actor(managed, admin);
        await request(context.app.getHttpServer())
          [method](`/api/team/${team.id}`)
          .send(method === 'delete' ? undefined : dto)
          .expect(method === 'delete' ? 202 : 200);
      }
    },
  );

  it.each(['patch', 'delete'] as const)(
    'denies management outside the current organization on %s',
    async (method) => {
      actor(['destination']);
      await request(context.app.getHttpServer())
        [method](`/api/team/${team.id}`)
        .send(method === 'delete' ? undefined : dto)
        .expect(403);
      expect(prisma.team.update).not.toHaveBeenCalled();
      expect(prisma.team.delete).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['patch'] as const)(
    'requires access to both organizations before moving a team via %s',
    async (method) => {
      for (const managed of [['department-it'], ['destination']]) {
        actor(managed);
        await request(context.app.getHttpServer())
          [method](`/api/team/${team.id}`)
          .send({ name: dto.name, organizationId: 'destination' })
          .expect(403);
        expect(prisma.team.update).not.toHaveBeenCalled();
      }
      actor(['parent', 'destination']);
      await request(context.app.getHttpServer())
        [method](`/api/team/${team.id}`)
        .send({ name: dto.name, organizationId: ' destination ' })
        .expect(200);
      expect(prisma.team.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'destination' }),
        }),
      );
    },
  );

  it.each(['patch', 'delete'] as const)(
    'allows the existing team manager on %s',
    async (method) => {
      actor([]);
      prisma.team.findUnique.mockResolvedValue({
        ...team,
        managerId: 'test-user',
      });
      await request(context.app.getHttpServer())
        [method](`/api/team/${team.id}`)
        .send(method === 'delete' ? undefined : dto)
        .expect(method === 'delete' ? 202 : 200);
    },
  );

  it('does not grant rights from the managerId provided in the request', async () => {
    actor([]);
    await request(context.app.getHttpServer())
      .patch(`/api/team/${team.id}`)
      .send({ managerId: 'test-user' })
      .expect(403);
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  it('does not let a team manager create another team in the organization', async () => {
    actor([]);
    prisma.team.findUnique.mockResolvedValue({
      ...team,
      managerId: 'test-user',
    });
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send({ ...dto, managerId: 'test-user' })
      .expect(403);
    expect(prisma.team.create).not.toHaveBeenCalled();
  });

  it.each(['patch'] as const)(
    'requires destination rights when a team manager moves their team via %s',
    async (method) => {
      actor([]);
      prisma.team.findUnique.mockResolvedValue({
        ...team,
        managerId: 'test-user',
      });
      await request(context.app.getHttpServer())
        [method](`/api/team/${team.id}`)
        .send({ name: dto.name, organizationId: 'destination' })
        .expect(403);
      expect(prisma.team.update).not.toHaveBeenCalled();
      actor(['destination']);
      await request(context.app.getHttpServer())
        [method](`/api/team/${team.id}`)
        .send({ name: dto.name, organizationId: 'destination' })
        .expect(200);
    },
  );

  it('checks the current organization even when the patch omits organizationId', async () => {
    actor([]);
    await request(context.app.getHttpServer())
      .patch(`/api/team/${team.id}`)
      .send({ name: 'Renamed' })
      .expect(403);
    expect(prisma.team.update).not.toHaveBeenCalled();
  });
});
