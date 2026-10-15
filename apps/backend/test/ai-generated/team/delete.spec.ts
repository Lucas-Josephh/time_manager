import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team HTTP API: delete', () => {
  const context = useTeamFixture();
  const { prisma, team, envelope } = context;
  it('deletes a team', async () => {
    await request(context.app.getHttpServer())
      .delete(`/api/team/${team.id}`)
      .expect(202)
      .expect(envelope('team_deleted', team));
    expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: team.id } });
  });
});
