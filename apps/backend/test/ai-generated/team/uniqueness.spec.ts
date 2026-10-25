import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team HTTP API: uniqueness', () => {
  const context = useTeamFixture();
  const { prisma, dto, team, envelope } = context;
  it.each(['patch'] as const)(
    'allows the current name in %s and excludes only the route ID',
    async (method) => {
      await request(context.app.getHttpServer())
        [method](`/api/team/${team.id}`)
        .send(dto)
        .expect(200)
        .expect(
          envelope(
            'team_partially_updated',
            team,
          ),
        );
      expect(prisma.team.findFirst).toHaveBeenCalledWith({
        where: { AND: [{ name: dto.name }, { id: { not: team.id } }] },
        select: { id: true },
      });
    },
  );

  it.each(['post', 'patch'] as const)(
    'rejects duplicate names in %s',
    async (method) => {
      prisma.team.findFirst.mockResolvedValue({ id: 'other-team' });
      await request(context.app.getHttpServer())
        [method](method === 'post' ? '/api/team' : `/api/team/${team.id}`)
        .send(dto)
        .expect(400)
        .expect(
          envelope(
            'validation_failed',
            { errors: [{ field: 'name', messages: ['already_exists'] }] },
            false,
          ),
        );
      expect(prisma.team.create).not.toHaveBeenCalled();
      expect(prisma.team.update).not.toHaveBeenCalled();
    },
  );

  it('does not accept a body ID as the record to exclude', async () => {
    prisma.team.findFirst.mockResolvedValue({ id: 'other-team' });
    const response = await request(context.app.getHttpServer())
      .patch(`/api/team/${team.id}`)
      .send({ name: dto.name, id: 'other-team' })
      .expect(400);
    expect(response.body.data.errors).toEqual(expect.arrayContaining([
      { field: 'id', messages: ['validation_unknown_field'] },
      { field: 'name', messages: ['already_exists'] },
    ]));
    expect(prisma.team.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ name: dto.name }, { id: { not: team.id } }] },
      select: { id: true },
    });
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  it('keeps the route IDs separate for concurrent updates and excludes nothing on creation', async () => {
    // Keep both validations in progress at the same time.
    const pending: (() => void)[] = [];
    prisma.team.findFirst.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        pending.push(resolve);
        if (pending.length === 2) pending.forEach((release) => release());
      });
      return null;
    });
    await Promise.all([
      request(context.app.getHttpServer())
        .patch('/api/team/first-team')
        .send({ name: 'First' })
        .expect(200),
      request(context.app.getHttpServer())
        .patch('/api/team/second-team')
        .send({ name: 'Second' })
        .expect(200),
    ]);
    expect(prisma.team.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ name: 'First' }, { id: { not: 'first-team' } }] },
      select: { id: true },
    });
    expect(prisma.team.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ name: 'Second' }, { id: { not: 'second-team' } }] },
      select: { id: true },
    });

    prisma.team.findFirst.mockResolvedValue(null);
    await request(context.app.getHttpServer())
      .post('/api/team?id=first-team')
      .send(dto)
      .expect(201);
    expect(prisma.team.findFirst).toHaveBeenLastCalledWith({
      where: { name: dto.name },
      select: { id: true },
    });
  });

  it('does not check name uniqueness when a patch omits the name', async () => {
    await request(context.app.getHttpServer())
      .patch(`/api/team/${team.id}`)
      .send({ managerId: null })
      .expect(200);
    expect(prisma.team.findFirst).not.toHaveBeenCalled();
  });

});
