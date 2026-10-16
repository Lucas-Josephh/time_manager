import 'reflect-metadata';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { SerializeResponse } from '../src/common/serialization/serialize-response.decorator';
import { TeamWithRelationsDto } from '../src/team/dto/team.dto';
import { UserSummaryDto } from '../src/user/dto/user.dto';

@SerializeResponse(TeamWithRelationsDto)
class Controller {
  teams() {}

  @SerializeResponse(UserSummaryDto)
  user() {}
}

async function response(data: unknown, method: 'teams' | 'user' = 'teams') {
  const context = new ExecutionContextHost(
    [],
    Controller,
    Controller.prototype[method],
  );
  const interceptor = new ResponseInterceptor(new Reflector());
  const result = await lastValueFrom(
    interceptor.intercept(context, { handle: () => of(data) }),
  );
  return JSON.parse(JSON.stringify(result));
}

describe('DTO response serialization', () => {
  const user = {
    id: 'u1',
    firstname: 'Alice',
    lastname: 'Martin',
    image: null,
    email: 'private@example.com',
    isAdmin: true,
    futureField: 'secret',
    sessions: [{ token: 'secret' }],
  };
  const summary = {
    id: 'u1',
    firstname: 'Alice',
    lastname: 'Martin',
    image: null,
  };

  it('filters nested users and organizations while preserving inherited team fields', async () => {
    const createdAt = new Date('2026-10-14T12:00:00.000Z');
    const team = {
      id: 't1',
      name: 'Support',
      createdAt,
      manager: user,
      members: [user],
      organization: {
        id: 'd1',
        name: 'Operations',
        createdAt,
        teams: [],
        futureField: 'secret',
      },
      futureField: 'secret',
    };
    expect(await response([team])).toEqual({
      success: true,
      message: 'request_successful',
      data: [
        {
          id: 't1',
          name: 'Support',
          createdAt: createdAt.toISOString(),
          manager: summary,
          members: [summary],
          organization: { id: 'd1', name: 'Operations', createdAt: createdAt.toISOString() },
        },
      ],
    });
    expect(team.manager.email).toBe(user.email);
    expect(team.organization.teams).toEqual([]);
  });

  it('supports method overrides for direct user responses', async () => {
    expect((await response(user, 'user')).data).toEqual(summary);
  });

  it('preserves null relations, empty lists and absent fields', async () => {
    expect(
      (await response({ id: 't1', manager: null, members: [] })).data,
    ).toEqual({ id: 't1', manager: null, members: [] });
    expect((await response([], 'user')).data).toEqual([]);
    expect((await response({ id: 'u1' }, 'user')).data).toEqual({ id: 'u1' });
  });

  it('preserves the empty envelope for absent records', async () => {
    expect((await response(null)).data).toEqual({});
    expect((await response(undefined)).data).toEqual({});
  });
});
