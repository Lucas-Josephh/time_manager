import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from '../../../src/auth/auth.service';
import { useTeamFixture } from './team.fixture';

describe('Team authentication composition', () => {
  const context = useTeamFixture();
  const routes = [
    ['post', '/api/team', 201],
    ['patch', '/api/team/team-support', 200],
    ['delete', '/api/team/team-support', 200],
    ['get', '/api/team', 200],
    ['get', '/api/team/team-support', 200],
    ['get', '/api/team/available-users?usage=member&teamId=team-support', 200],
  ] as const;

  it.each(routes)(
    'authenticates exactly once on %s %s',
    async (method, path, status) => {
      const session = jest.spyOn(context.app.get(AuthService), 'getSession');
      context.prisma.user.findMany.mockResolvedValue([]);
      try {
        await request(context.app.getHttpServer())
          [method](path)
          .send(
            method === 'get' || method === 'delete' ? undefined : context.dto,
          )
          .expect(status);
        expect(session).toHaveBeenCalledTimes(1);
      } finally {
        session.mockRestore();
      }
    },
  );

  it.each(routes)(
    'rejects unauthenticated access before database reads on %s %s',
    async (method, path) => {
      const session = jest
        .spyOn(context.app.get(AuthService), 'getSession')
        .mockRejectedValueOnce(new UnauthorizedException());
      try {
        await request(context.app.getHttpServer())
          [method](path)
          .send(context.dto)
          .expect(401);
        expect(session).toHaveBeenCalledTimes(1);
        expect(context.prisma.team.findUnique).not.toHaveBeenCalled();
        expect(context.prisma.team.findMany).not.toHaveBeenCalled();
        expect(context.prisma.user.findUnique).not.toHaveBeenCalled();
        expect(context.prisma.team.create).not.toHaveBeenCalled();
        expect(context.prisma.team.update).not.toHaveBeenCalled();
        expect(context.prisma.team.delete).not.toHaveBeenCalled();
      } finally {
        session.mockRestore();
      }
    },
  );
});
