import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team creation: memberIds validation', () => {
  const context = useTeamFixture();

  it.each([
    null,
    'user-1',
    [42],
    [''],
    ['   '],
    ['user-1', 'user-1'],
    ['user-1', ' user-1 '],
  ])('rejects invalid members %j', async (memberIds) => {
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send({ ...context.dto, memberIds })
      .expect(400);
    expect(context.prisma.team.create).not.toHaveBeenCalled();
  });

  it.each(['patch'] as const)(
    'rejects null memberIds in %s',
    async (method) => {
      await request(context.app.getHttpServer())
        [method](`/api/team/${context.team.id}`)
        .send({ ...context.dto, memberIds: null })
        .expect(400);
      expect(context.prisma.team.update).not.toHaveBeenCalled();
    },
  );

  it('accepts an empty member list', async () => {
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send({ ...context.dto, memberIds: [] })
      .expect(201);
  });
});
