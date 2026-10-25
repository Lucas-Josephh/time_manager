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
    [{ organizationId: ' dept ' }, { organizationId: 'dept' }],
    [{ managerId: ' manager ' }, { managerId: 'manager' }],
    [{ memberId: ' member ' }, { members: { some: { id: 'member' } } }],
    [
      {
        name: 'Support',
        organizationId: 'dept',
        managerId: 'manager',
        memberId: 'member',
      },
      {
        name: { contains: 'Support', mode: 'insensitive' },
        organizationId: 'dept',
        managerId: 'manager',
        members: { some: { id: 'member' } },
      },
    ],
  ])('lists teams using filters %#', async (query, where) => {
    await request(context.app.getHttpServer())
      .get('/api/team')
      .query(query)
      .expect(200)
      .expect(envelope('team_listed', { items: [team], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } }));
    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 0, take: 10,
      include: relations,
    });
  });

  it('returns an empty list', async () => {
    prisma.team.findMany.mockResolvedValue([]);
    prisma.team.count.mockResolvedValue(0);
    await request(context.app.getHttpServer())
      .get('/api/team')
      .expect(200)
      .expect(envelope('team_listed', { items: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }));
  });

  it.each([
    { name: ' ' },
    { unexpected: 'value' },
    { memberId: ['a', 'b'] },
    { organizationId: ' ' },
    { managerId: ' ' },
    { memberId: ' ' },
  ])('rejects invalid query %j', async (query) => {
    await request(context.app.getHttpServer())
      .get('/api/team')
      .query(query)
      .expect(400);
    expect(prisma.team.findMany).not.toHaveBeenCalled();
  });
});
