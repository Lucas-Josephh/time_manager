import request from 'supertest';
import { ConflictException } from '@nestjs/common';
import { TeamService } from '../../../src/team/team.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { useTeamFixture } from './team.fixture';

describe('Team creation: memberIds validation', () => {
  const context = useTeamFixture();

  it.each([
    null,
    'user-1',
    [42],
    [''],
    ['   '],
    ['user-1', 'user-1'],
    ['user-1', ' user-1 '],
  ])('rejects invalid members %j', async (memberIds) => {
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send({ ...context.dto, memberIds })
      .expect(400);
    expect(context.prisma.team.create).not.toHaveBeenCalled();
  });

  it.each(['put', 'patch'] as const)(
    'rejects null memberIds in %s',
    async (method) => {
      await request(context.app.getHttpServer())
        [method](`/api/team/${context.team.id}`)
        .send({ ...context.dto, memberIds: null })
        .expect(400);
      expect(context.prisma.team.update).not.toHaveBeenCalled();
    },
  );

  it('accepts an empty member list', async () => {
    await request(context.app.getHttpServer())
      .post('/api/team')
      .send({ ...context.dto, memberIds: [] })
      .expect(201);
  });
});

describe('Team creation: atomic member assignment', () => {
  const dto = {
    name: 'Support',
    organizationId: 'org',
    memberIds: ['u1', 'u2'],
  };
  const team = {
    id: 'team',
    name: dto.name,
    organizationId: dto.organizationId,
  };
  const tx = {
    organization: { findMany: jest.fn() },
    team: { create: jest.fn(), findUnique: jest.fn() },
    user: { updateMany: jest.fn(), findMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    team: { findFirst: jest.fn() },
    organization: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const service = new TeamService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.team.findFirst.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue({ id: 'org' });
    prisma.user.findUnique.mockResolvedValue({ id: 'manager' });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.organization.findMany
      .mockResolvedValueOnce([{ id: 'child' }])
      .mockResolvedValue([]);
    tx.team.create.mockResolvedValue(team);
    tx.team.findUnique.mockResolvedValue(team);
    tx.user.updateMany.mockResolvedValue({ count: 2 });
    tx.user.findMany.mockResolvedValue([]);
  });

  it('assigns members from the organization and its descendants within the transaction', async () => {
    await expect(service.create(dto)).resolves.toEqual(team);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: dto.memberIds },
        teamId: null,
        organizationId: { in: ['org', 'child'] },
      },
      data: { teamId: 'team' },
    });
  });

  it.each([{ memberIds: undefined }, { memberIds: [] }, { memberIds: ['manager'] }])('automatically includes the manager once with members %j', async ({ memberIds }) => {
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    await service.create({ name: 'Support', organizationId: 'org', managerId: 'manager', memberIds });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ['manager'] }, teamId: null }),
    }));
  });

  it.each([0, 1])(
    'aborts the transaction if only %i members are eligible',
    async (count) => {
      tx.user.updateMany.mockResolvedValue({ count });
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow(
        'team_members_unavailable',
      );
    },
  );
});

describe('Team updates: member replacement', () => {
  const team = { id: 'team', organizationId: 'org' };
  const tx = {
    team: { update: jest.fn(), findUnique: jest.fn() },
    organization: { findMany: jest.fn() },
    user: { updateMany: jest.fn(), findMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    team: { update: jest.fn(), findFirst: jest.fn() },
    organization: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const service = new TeamService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.team.findFirst.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue({ id: 'org' });
    prisma.user.findUnique.mockResolvedValue({ id: 'manager' });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.team.update.mockResolvedValue(team);
    tx.team.findUnique.mockResolvedValue(team);
    tx.organization.findMany.mockResolvedValue([]);
    tx.user.updateMany.mockResolvedValue({ count: 2 });
    tx.user.findMany.mockResolvedValue([]);
  });

  it.each(['replace', 'update'] as const)(
    '%s replaces members and accepts existing members',
    async (method) => {
      await service[method](team.id, {
        name: 'Support',
        organizationId: 'org',
        memberIds: ['u1', 'u2'],
      });
      expect(tx.team.update).toHaveBeenCalledWith({
        where: { id: team.id },
        data: { name: 'Support', organizationId: 'org' },
      });
      expect(tx.user.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          id: { in: ['u1', 'u2'] },
          OR: [{ teamId: null }, { teamId: team.id }],
          organizationId: { in: ['org'] },
        },
        data: { teamId: team.id },
      });
      expect(tx.user.updateMany).toHaveBeenNthCalledWith(2, {
        where: { teamId: team.id, id: { notIn: ['u1', 'u2'] } },
        data: { teamId: null },
      });
    },
  );

  it('identifies unavailable members without reporting successfully assigned members', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.user.findMany.mockResolvedValue([
      { id: 'ok', firstname: 'A', lastname: 'B', teamId: team.id, organizationId: 'org' },
      { id: 'busy', firstname: 'C', lastname: 'D', teamId: 'other', organizationId: 'org' },
      { id: 'outside', firstname: 'E', lastname: 'F', teamId: null, organizationId: 'elsewhere' },
    ]);
    try {
      await service.update(team.id, { memberIds: ['ok', 'busy', 'outside', 'missing'] });
      throw new Error('Expected a conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        message: 'team_members_unavailable',
        data: { unavailableMembers: [
          { id: 'busy', firstname: 'C', lastname: 'D', reason: 'already_in_team' },
          { id: 'outside', firstname: 'E', lastname: 'F', reason: 'outside_organization' },
          { id: 'missing', reason: 'not_found' },
        ] },
      });
    }
    expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
  });

  it('assigns the manager without removing existing members when memberIds is omitted', async () => {
    tx.team.update.mockResolvedValue({ ...team, managerId: 'manager' });
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    await service.update(team.id, { managerId: 'manager' });
    expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['manager'] }, OR: [{ teamId: null }, { teamId: team.id }], organizationId: { in: ['org'] } },
      data: { teamId: team.id },
    });
  });

  it.each([{ memberIds: [] }, { memberIds: ['manager'] }])('retains the current manager when replacing members with %j', async ({ memberIds }) => {
    tx.team.update.mockResolvedValue({ ...team, managerId: 'manager' });
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    await service.update(team.id, { memberIds });
    expect(tx.user.updateMany).toHaveBeenNthCalledWith(2, {
      where: { teamId: team.id, id: { notIn: ['manager'] } }, data: { teamId: null },
    });
  });

  it('rejects a manager already assigned to another team', async () => {
    tx.team.update.mockResolvedValue({ ...team, managerId: 'manager' });
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    tx.user.findMany.mockResolvedValue([
      { id: 'manager', firstname: 'A', lastname: 'B', teamId: 'other', organizationId: 'org' },
    ]);
    await expect(service.update(team.id, { managerId: 'manager' })).rejects.toMatchObject({
      response: { message: 'team_members_unavailable', data: { unavailableMembers: [
        { id: 'manager', firstname: 'A', lastname: 'B', reason: 'already_in_team' },
      ] } },
    });
    expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
  });

  it('removes only the manager role when managerId is null and members are omitted', async () => {
    await service.update(team.id, { managerId: null });
    expect(prisma.team.update).toHaveBeenCalledWith({ where: { id: team.id }, data: { managerId: null }, include: { manager: true, organization: true, members: true } });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('clears all members for an empty list', async () => {
    await service.update(team.id, { memberIds: [] });
    expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { teamId: team.id, id: { notIn: [] } },
      data: { teamId: null },
    });
  });

  it('does not touch members when omitted', async () => {
    await service.update(team.id, { name: 'Renamed' });
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: team.id },
      data: { name: 'Renamed' },
      include: { manager: true, organization: true, members: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses the updated organization and aborts on unavailable members before removing anyone', async () => {
    tx.team.update.mockResolvedValue({ ...team, organizationId: 'new-org' });
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update(team.id, {
        organizationId: 'new-org',
        memberIds: ['missing'],
      }),
    ).rejects.toThrow('team_members_unavailable');
    expect(tx.organization.findMany).toHaveBeenCalledWith({
      where: { parentId: { in: ['new-org'] } },
      select: { id: true },
    });
    expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
  });
});
