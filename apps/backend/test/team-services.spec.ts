import { OrganizationHierarchyService } from '../src/organization/services/organization-hierarchy.service';
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TeamAuthorizationService } from '../src/team/services/team-authorization.service';
import { TeamMembersService } from '../src/team/services/team-members.service';
import { TeamService } from '../src/team/services/team.service';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Team } from '../src/generated/prisma/client';

describe('Team providers', () => {
  const team = { id: 'target', organizationId: 'child', managerId: 'team-manager' } as Team;
  const prisma = {
    organization: {
      findUnique: jest.fn(async ({ where }) => where.id === 'child' ? { id: 'child', parentId: 'root', managerId: null } : { id: 'root', parentId: null, managerId: 'org-manager' }),
      findMany: jest.fn(async () => []),
    },
    team: { findUniqueOrThrow: jest.fn(async () => team), findMany: jest.fn(async () => []), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    user: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  let authorization: TeamAuthorizationService;
  let members: TeamMembersService;
  let service: TeamService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [OrganizationHierarchyService, TeamAuthorizationService, TeamMembersService, TeamService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: { isAdmin: async (actor: string) => actor === 'admin' } }],
    }).compile();
    authorization = module.get(TeamAuthorizationService);
    members = module.get(TeamMembersService);
    service = module.get(TeamService);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(callback => callback(prisma));
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);
  });
  it.each([
    ['admin', true, true], ['org-manager', true, true],
    ['team-manager', true, false], ['member', false, false],
  ] as const)('checks the action matrix for %s', async (actor, canManageMembers, canChangeManager) => {
    const membership = authorization.assertCanManageMembers(team, actor);
    if (canManageMembers) await expect(membership).resolves.toBeUndefined();
    else await expect(membership).rejects.toBeInstanceOf(ForbiddenException);
    const management = authorization.assertCanChangeManager(team, actor);
    if (canChangeManager) await expect(management).resolves.toBeUndefined();
    else await expect(management).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('checks all creation candidates before creating or assigning anything', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'free', teamId: null, organizationId: null }]);
    await expect(service.create({ name: 'New', organizationId: 'child', memberIds: ['free', 'missing'] }, 'admin')).rejects.toThrow();
    expect(prisma.team.create).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it('rejects deletion of a populated team', async () => {
    prisma.user.count.mockResolvedValue(1);
    await expect(service.delete('target', 'admin')).rejects.toThrow('team_has_members');
    expect(prisma.team.delete).not.toHaveBeenCalled();
  });
  it('uses one serializable transaction for member writes', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'free', teamId: null, organizationId: null }]);
    await members.add('target', ['free'], 'admin');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['free'] } }, data: { teamId: 'target' } });
  });
});
