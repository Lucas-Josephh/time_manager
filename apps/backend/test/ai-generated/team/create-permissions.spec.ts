import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from '../../../src/auth/auth.service';
import { useTeamFixture } from './team.fixture';

describe('Team creation permissions', () => {
  const context = useTeamFixture();
  const { prisma, dto } = context;
  const organizations: Record<
    string,
    { managerId: string | null; parentId: string | null }
  > = {
    root: { managerId: 'root-manager', parentId: null },
    parent: { managerId: 'parent-manager', parentId: 'root' },
    'department-it': { managerId: 'local-manager', parentId: 'parent' },
    sibling: { managerId: 'sibling-manager', parentId: 'parent' },
    child: { managerId: 'child-manager', parentId: 'department-it' },
  };

  function actor(id: string, isAdmin = false) {
    // The session's ID is test-user; roles and management links come from the database.
    prisma.user.findUnique.mockResolvedValue({ id: 'test-user', isAdmin });
    prisma.organization.findUnique.mockImplementation(
      async ({ where, select }) => {
        const organization = organizations[where.id];
        if (!organization) return null;
        return {
          id: where.id,
          ...organization,
          managerId:
            organization.managerId === id
              ? 'test-user'
              : organization.managerId,
          ...(select?.id ? { id: where.id } : {}),
        };
      },
    );
  }

  it.each(['local-manager', 'parent-manager', 'root-manager'])(
    'allows %s to create in the target organization',
    async (id) => {
      actor(id);
      await request(context.app.getHttpServer())
        .post('/api/team')
        .send(dto)
        .expect(201);
      expect(prisma.team.create).toHaveBeenCalledTimes(1);
    },
  );

  it('allows an administrator outside the organization', async () => {
    actor('admin', true);
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send(dto)
      .expect(201);
  });

  it.each([
    'member',
    'team-manager',
    'sibling-manager',
    'child-manager',
    'unrelated-manager',
  ])('denies %s without writing a team or members', async (id) => {
    actor(id);
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send(dto)
      .expect(403);
    expect(prisma.team.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an absent or expired session before accessing the database', async () => {
    const spy = jest
      .spyOn(context.app.get(AuthService), 'getSession')
      .mockRejectedValueOnce(new UnauthorizedException());
    try {
      await request(context.app.getHttpServer())
        .post('/api/team')
        .send(dto)
        .expect(401);
      expect(prisma.team.create).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('denies a deleted session user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send(dto)
      .expect(403);
    expect(prisma.team.create).not.toHaveBeenCalled();
  });

  it('terminates and denies access when the parent chain contains a cycle', async () => {
    actor('member');
    prisma.organization.findUnique.mockResolvedValue({
      id: dto.organizationId,
      managerId: null,
      parentId: dto.organizationId,
    });
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send(dto)
      .expect(403);
    expect(prisma.team.create).not.toHaveBeenCalled();
  });
  it('uses the authenticated user rather than the requested team manager', async () => {
    actor('member');
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send({ ...dto, managerId: 'local-manager', memberIds: ['test-user'] })
      .expect(403);
    expect(prisma.team.create).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('checks permissions using the normalized organization identifier', async () => {
    actor('local-manager');
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send({ ...dto, organizationId: ` ${dto.organizationId} ` })
      .expect(201);
    expect(prisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: dto.organizationId }),
      }),
    );
  });

  it('denies access if an ancestor disappears during the lookup', async () => {
    actor('member');
    prisma.organization.findUnique.mockImplementation(async ({ where }) =>
      where.id === dto.organizationId
        ? { id: where.id, managerId: null, parentId: 'missing' }
        : null,
    );
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send(dto)
      .expect(403);
    expect(prisma.team.create).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    '',
    '   ',
    123,
    ['department-it'],
    { id: 'department-it' },
  ])(
    'leaves invalid organization identifiers to DTO validation: %j',
    async (organizationId) => {
      actor('member');
      const response = await request(context.app.getHttpServer())
        .post('/api/team')
        .send({ ...dto, organizationId })
        .expect(400);
      expect(response.body.message).toBe('validation_failed');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.team.create).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    },
  );

  it('does not write when the permission lookup fails', async () => {
    actor('member');
    prisma.user.findUnique.mockRejectedValue(
      new Error('private database details'),
    );
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send(dto)
      .expect(500)
      .expect({ success: false, message: 'internal_server_error', data: {} });
    expect(prisma.team.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
