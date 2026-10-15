import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team HTTP API: list', () => {
  const context = useTeamFixture();
  const { prisma, team, relations, envelope } = context;
  it.each([
    [{}, {}],
    [
      { name: ' Support ' },
      { name: { contains: 'Support', mode: 'insensitive' } },
    ],
    [{ departmentId: 'dept' }, { departmentId: 'dept' }],
    [{ managerId: 'manager' }, { managerId: 'manager' }],
    [{ memberId: 'member' }, { members: { some: { id: 'member' } } }],
    [
      {
        name: 'Support',
        departmentId: 'dept',
        managerId: 'manager',
        memberId: 'member',
      },
      {
        name: { contains: 'Support', mode: 'insensitive' },
        departmentId: 'dept',
        managerId: 'manager',
        members: { some: { id: 'member' } },
      },
    ],
  ])('lists teams using filters %#', async (query, where) => {
    await request(context.app.getHttpServer())
      .get('/api/team')
      .query(query)
      .expect(200)
      .expect(envelope('team_listed', [team]));
    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { name: 'asc' },
      include: relations,
    });
  });

  it('returns an empty list', async () => {
    prisma.team.findMany.mockResolvedValue([]);
    await request(context.app.getHttpServer())
      .get('/api/team')
      .expect(200)
      .expect(envelope('team_listed', []));
  });

  it.each([{ name: ' ' }, { unexpected: 'value' }, { memberId: ['a', 'b'] }])(
    'rejects invalid query %j',
    async (query) => {
      await request(context.app.getHttpServer())
        .get('/api/team')
        .query(query)
        .expect(400);
      expect(prisma.team.findMany).not.toHaveBeenCalled();
    },
  );
});
