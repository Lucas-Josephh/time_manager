import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team organization changes', () => {
  const context = useTeamFixture();
  const { prisma, team, dto } = context;
  const moved = { ...team, organizationId: 'destination' };
  const member = {
    id: 'member',
    firstname: 'Alice',
    lastname: 'Martin',
    teamId: team.id,
    organizationId: team.organizationId,
  };
  beforeEach(() => {
    prisma.team.update.mockResolvedValue(moved);
    prisma.team.findUnique.mockImplementation(async ({ include }) =>
      include ? moved : team,
    );
  });

  it.each(['put', 'patch'] as const)('allows an admin to retain members outside the destination via %s', async method => {
    prisma.user.findMany.mockResolvedValue([member]);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    await request(context.app.getHttpServer())[method](`/api/team/${team.id}`)
      .send({ name: dto.name, organizationId: 'destination' }).expect(200);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [member.id] } }, data: { teamId: team.id },
    });
    expect(member.organizationId).toBe(team.organizationId);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('keeps the manager when moving the team, even with an explicit empty member list', async () => {
    const manager = { ...member, id: 'manager' };
    prisma.team.update.mockResolvedValue({ ...moved, managerId: manager.id });
    prisma.user.findMany.mockResolvedValue([manager]);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    await request(context.app.getHttpServer()).patch(`/api/team/${team.id}`)
      .send({ organizationId: 'destination', memberIds: [] }).expect(200);
    expect(prisma.user.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: ['manager'] } }, data: { teamId: team.id },
    });
  });

  it('allows removing the manager and members while moving the team', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    await request(context.app.getHttpServer())
      .patch(`/api/team/${team.id}`)
      .send({ organizationId: 'destination', managerId: null, memberIds: [] })
      .expect(200);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { teamId: team.id, id: { notIn: [] } },
      data: { teamId: null },
    });
  });

  it('does not check members removed by an explicit replacement list', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    await request(context.app.getHttpServer())
      .patch(`/api/team/${team.id}`)
      .send({ organizationId: 'destination', memberIds: ['replacement'] })
      .expect(200);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['replacement'] } }, select: { id: true, teamId: true },
    });
    expect(prisma.user.updateMany).toHaveBeenNthCalledWith(2, {
      where: { teamId: team.id, id: { notIn: ['replacement'] } },
      data: { teamId: null },
    });
  });
});
