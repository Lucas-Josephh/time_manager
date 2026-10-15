import request from 'supertest';
import { Prisma } from '../../../src/generated/prisma/client';
import { useTeamFixture } from './team.fixture';

describe('Team HTTP API: errors', () => {
  const context = useTeamFixture();
  const { prisma, dto, team, envelope } = context;
  it.each([
    ['post', 'create', 'P2002', 409, 'already_exists'],
    ['post', 'create', 'P2003', 409, 'reference_conflict'],
    ['delete', 'delete', 'P2003', 409, 'reference_conflict'],
    ['put', 'update', 'P2025', 404, 'team_not_found'],
    ['patch', 'update', 'P2025', 404, 'team_not_found'],
    ['delete', 'delete', 'P2025', 404, 'team_not_found'],
  ] as const)(
    'maps %s database error %s %s',
    async (method, operation, code, status, message) => {
      prisma.team[operation].mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('private database detail', {
          code,
          clientVersion: '7.10.0',
          meta: { modelName: 'Team' },
        }),
      );
      await request(context.app.getHttpServer())
        [method](method === 'post' ? '/api/team' : `/api/team/${team.id}`)
        .send(method === 'delete' ? undefined : dto)
        .expect(status)
        .expect(envelope(message, {}, false));
    },
  );

  it('hides unexpected database failures', async () => {
    prisma.team.findMany.mockRejectedValue(
      new Error('private connection credentials'),
    );
    await request(context.app.getHttpServer())
      .get('/api/team')
      .expect(500)
      .expect(envelope('internal_server_error', {}, false));
  });
});
