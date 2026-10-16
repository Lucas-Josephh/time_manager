import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from '../../../src/auth/auth.service';
import { useTeamFixture } from './team.fixture';

describe('Team HTTP API: authentication', () => {
  const context = useTeamFixture();

  it('passes request cookies to the session service before accessing teams', async () => {
    await request(context.app.getHttpServer())
      .get('/api/team')
      .set('Cookie', 'session=test-token')
      .expect(200);
    expect(context.app.get(AuthService).getSession).toHaveBeenCalledWith(
      expect.objectContaining({ cookie: 'session=test-token' }),
    );
    expect(context.prisma.team.findMany).toHaveBeenCalledTimes(1);
  });

  it.each(['get', 'post', 'put', 'patch', 'delete'] as const)(
    'rejects unauthenticated %s requests before accessing data',
    async (method) => {
      jest
        .mocked(context.app.get(AuthService).getSession)
        .mockRejectedValueOnce(new UnauthorizedException());
      await request(context.app.getHttpServer())
        [method](
          method === 'get' || method === 'post'
            ? '/api/team'
            : '/api/team/team-support',
        )
        .send(method === 'get' || method === 'delete' ? undefined : context.dto)
        .expect(401)
        .expect({ success: false, message: 'unauthorized', data: {} });
      for (const operation of Object.values(context.prisma.team)) {
        expect(operation).not.toHaveBeenCalled();
      }
    },
  );
});
