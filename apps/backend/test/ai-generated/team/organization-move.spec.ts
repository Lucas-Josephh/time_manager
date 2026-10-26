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

  describe.each(['patch'] as const)('%s permissions', method => {
    it.each([
      ['neither organization', false, false, 403],
      ['only the destination organization', false, true, 403],
      ['only the source organization', true, false, 403],
      ['both organizations', true, true, 200],
    ] as const)(
      'allows a team move only with rights on both organizations: %s',
      async (_scope, managesSource, managesDestination, status) => {
        const actor = 'test-user';
        prisma.user.findUnique.mockResolvedValue({ id: actor, isAdmin: false });
        prisma.team.findUnique.mockResolvedValue({ ...team, managerId: actor });
        prisma.organization.findUnique.mockImplementation(async ({ where }) => ({
          id: where.id,
          parentId: null,
          managerId:
            (where.id === team.organizationId && managesSource) ||
            (where.id === 'destination' && managesDestination)
              ? actor
              : null,
        }));

        await request(context.app.getHttpServer())[method](`/api/team/${team.id}`)
          .send({ name: dto.name, organizationId: 'destination' })
          .expect(status);

        if (status === 403) {
          expect(prisma.team.update).not.toHaveBeenCalled();
          expect(prisma.user.updateMany).not.toHaveBeenCalled();
        }
      },
    );

    it('lets a team manager keep the same organization without organization rights', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'test-user', isAdmin: false });
      prisma.team.findUnique.mockResolvedValue({ ...team, managerId: 'test-user' });

      await request(context.app.getHttpServer())[method](`/api/team/${team.id}`)
        .send({ name: dto.name, organizationId: ` ${team.organizationId} ` })
        .expect(200);
    });
  });

  it.each(['patch'] as const)('allows an admin to retain members outside the destination via %s', async method => {
    prisma.user.findMany.mockResolvedValue([member]);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    await request(context.app.getHttpServer())[method](`/api/team/${team.id}`)
      .send({ name: dto.name, organizationId: 'destination' }).expect(200);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(member.organizationId).toBe(team.organizationId);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('rejects assignment fields during a move', async () => {
    await request(context.app.getHttpServer()).patch(`/api/team/${team.id}`)
      .send({ organizationId: 'destination', memberIds: [] }).expect(400);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
