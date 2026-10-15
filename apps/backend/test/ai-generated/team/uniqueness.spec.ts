import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team HTTP API: uniqueness', () => {
  const context = useTeamFixture();
  const { prisma, dto, team, envelope } = context;
  it.each(['put', 'patch'] as const)(
    'allows the current name in %s and excludes only the route ID',
    async (method) => {
      await request(context.app.getHttpServer())
        [method](`/api/team/${team.id}`)
        .send(dto)
        .expect(200)
        .expect(
          envelope(
            method === 'put' ? 'team_updated' : 'team_partially_updated',
            team,
          ),
        );
      expect(prisma.team.findFirst).toHaveBeenCalledWith({
        where: { name: dto.name, id: { not: team.id } },
        select: { id: true },
      });
    },
  );

  it.each(['post', 'put', 'patch'] as const)(
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
});
