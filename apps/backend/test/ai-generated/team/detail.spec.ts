import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team HTTP API: detail', () => {
  const context = useTeamFixture();
  const { prisma, team, relations, envelope } = context;
  it('serializes nested relations without exposing private user fields', async () => {
    const user = { id: 'user-manager', firstname: 'Alice', lastname: 'Martin' };
    const department = { id: 'department-it', name: 'IT' };
    prisma.team.findUnique.mockResolvedValue({
      ...team,
      department,
      manager: { ...user, email: 'private@example.com', password: 'secret' },
      members: [{ ...user, email: 'private@example.com' }],
      internal: 'secret',
    });
    await request(context.app.getHttpServer())
      .get(`/api/team/${team.id}`)
      .expect(200)
      .expect(
        envelope('request_successful', {
          ...team,
          department,
          manager: user,
          members: [user],
        }),
      );
    expect(prisma.team.findUnique).toHaveBeenCalledWith({
      where: { id: team.id },
      include: relations,
    });
  });

  it('returns an empty object for an absent team', async () => {
    prisma.team.findUnique.mockResolvedValue(null);
    await request(context.app.getHttpServer())
      .get('/api/team/missing')
      .expect(200)
      .expect(envelope('request_successful', {}));
  });
});
