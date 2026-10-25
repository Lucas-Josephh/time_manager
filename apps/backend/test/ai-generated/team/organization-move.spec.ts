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

  it.each(['put', 'patch'] as const)(
    'rejects retained members outside the destination on %s',
    async (method) => {
      prisma.user.findMany.mockResolvedValue([member]);
      prisma.user.updateMany.mockResolvedValue({ count: 0 });
      const response = await request(context.app.getHttpServer())
        [method](`/api/team/${team.id}`)
        .send({ name: dto.name, organizationId: 'destination' })
        .expect(409);
      expect(response.body).toMatchObject({
        message: 'team_members_unavailable',
        data: {
          unavailableMembers: [
            { id: member.id, reason: 'outside_organization' },
          ],
        },
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { teamId: team.id },
        select: { id: true },
      });
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });
      expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
    },
  );

  it('accepts retained members from the destination or its descendants', async () => {
    prisma.user.findMany.mockResolvedValue([
      { ...member, organizationId: 'child' },
    ]);
    prisma.organization.findMany.mockResolvedValueOnce([{ id: 'child' }]);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    const response = await request(context.app.getHttpServer())
      .patch(`/api/team/${team.id}`)
      .send({ organizationId: 'destination' })
      .expect(200);
    expect(response.body.data.organizationId).toBe('destination');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [member.id] },
        OR: [{ teamId: null }, { teamId: team.id }],
        organizationId: { in: ['destination', 'child'] },
      },
      data: { teamId: team.id },
    });
  });

  it('revalidates the retained manager even when memberIds is explicitly empty', async () => {
    const manager = { ...member, id: 'manager' };
    prisma.team.update.mockResolvedValue({ ...moved, managerId: manager.id });
    prisma.user.findMany.mockResolvedValue([manager]);
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    const response = await request(context.app.getHttpServer())
      .patch(`/api/team/${team.id}`)
      .send({ organizationId: 'destination', memberIds: [] })
      .expect(409);
    expect(response.body.data.unavailableMembers).toContainEqual(
      expect.objectContaining({
        id: manager.id,
        reason: 'outside_organization',
      }),
    );
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
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).toHaveBeenNthCalledWith(2, {
      where: { teamId: team.id, id: { notIn: ['replacement'] } },
      data: { teamId: null },
    });
  });
});
