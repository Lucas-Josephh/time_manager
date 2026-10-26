import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team HTTP API: update', () => {
  const context = useTeamFixture();
  const { prisma, dto, team, relations } = context;
  it.each(['patch'] as const)(
    'preserves omitted manager and accepts null in %s',
    async (method) => {
      await request(context.app.getHttpServer())
        [method](`/api/team/${team.id}`)
        .send(dto)
        .expect(200);
      expect(prisma.team.update).toHaveBeenLastCalledWith({
        where: { id: team.id },
        data: dto,
        include: relations,
      });
      await request(context.app.getHttpServer())
        [method](`/api/team/${team.id}/manager`)
        .send({ managerId: null })
        .expect(200);
      expect(prisma.team.update).toHaveBeenLastCalledWith({
        where: { id: team.id },
        data: { managerId: null },
        include: relations,
      });
    },
  );

  it('patches only supplied fields', async () => {
    await request(context.app.getHttpServer())
      .patch(`/api/team/${team.id}`)
      .send({ name: ' Renamed ' })
      .expect(200);
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: team.id },
      data: { name: 'Renamed' },
      include: relations,
    });
  });


});
