import request from 'supertest';
import { useTeamFixture } from './team/team.fixture';

// CRUD coverage lives in team/. Keep migration regressions here.
describe('Team API: organization migration', () => {
  const context = useTeamFixture();

  it.each(['post', 'put', 'patch'] as const)(
    'rejects the obsolete departmentId field on %s', async (method) => {
      const response = await request(context.app.getHttpServer())
        [method](method === 'post' ? '/api/team' : `/api/team/${context.team.id}`)
        .send({ ...context.dto, departmentId: 'old-department' })
        .expect(400);
      expect(response.body.data.errors).toContainEqual({
        field: 'departmentId', messages: ['validation_unknown_field'],
      });
      expect(context.prisma.team.create).not.toHaveBeenCalled();
      expect(context.prisma.team.update).not.toHaveBeenCalled();
    },
  );

  it('rejects the obsolete department filter', async () => {
    await request(context.app.getHttpServer())
      .get('/api/team?departmentId=old-department').expect(400);
    expect(context.prisma.team.findMany).not.toHaveBeenCalled();
  });
});
