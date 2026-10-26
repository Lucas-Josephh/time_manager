import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team HTTP API: create', () => {
  const context = useTeamFixture();
  const { prisma, dto, team, envelope } = context;
  it.each([undefined, null, 'user-manager'])(
    'creates a team with manager %s and trims inputs',
    async (managerId) => {
      const result = { ...team, managerId: managerId ?? null };
      prisma.team.create.mockResolvedValue(result);
      prisma.team.findUnique.mockResolvedValue(result);
      await request(context.app.getHttpServer())
        .post('/api/team')
        .send({
          name: ' Support ',
          organizationId: ' department-it ',
          managerId:
            typeof managerId === 'string' ? ` ${managerId} ` : managerId,
        })
        .expect(201)
        .expect(envelope('team_created', result));
      expect(prisma.team.create).toHaveBeenCalledWith({
        data: { ...dto, managerId },
      });
    },
  );
});
