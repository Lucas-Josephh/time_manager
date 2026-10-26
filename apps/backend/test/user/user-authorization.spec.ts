import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TeamService } from '../../src/team/services/team.service';
import { UserService } from '../../src/user/services/user.service';
import { UserAuthorizationService } from '../../src/user/services/user-authorization.service';
import { UserProvisioningService } from '../../src/user/services/user-provisioning.service';
import { createTestAuthService } from '../support/auth-service';
import { mockFindUniqueOrThrow } from '../support/mock-find-unique-or-throw';

describe('User service authorization without HTTP guards', () => {
  let service: UserService;
  let transactionalAdmin = false;
  const profile = { id: 'target', firstname: 'Alice', lastname: 'Martin' };
  const tx = {
    user: {
      findUniqueOrThrow: mockFindUniqueOrThrow,
      findUnique: jest.fn(async ({ where }) => where.id === 'actor' ? { isAdmin: transactionalAdmin } : profile),
      update: jest.fn(async () => profile),
      delete: jest.fn(async () => profile),
    },
  };
  const prisma = {
    user: {
      findUniqueOrThrow: mockFindUniqueOrThrow,
      findUnique: jest.fn(async ({ where }) => where.id === 'actor' ? { isAdmin: true } : profile),
      findMany: jest.fn(async () => [profile]), count: jest.fn(async () => 1),
    },
    $transaction: jest.fn(async operation => typeof operation === 'function' ? operation(tx) : Promise.all(operation)),
  };
  const provisioning = {
    create: jest.fn(async () => profile),
    rethrowCreationError: jest.fn(async (error: unknown) => { throw error; }),
  };
  const team = { getProvisioningMembership: jest.fn() };
  const dto = { firstname: 'Alice', lastname: 'Martin', email: 'alice@example.com', password: 'Temporary123!' };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [
      UserService, UserAuthorizationService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuthService, useValue: createTestAuthService(prisma) },
      { provide: UserProvisioningService, useValue: provisioning },
      { provide: TeamService, useValue: team },
    ] }).compile();
    service = module.get(UserService);
  });
  beforeEach(() => { jest.clearAllMocks(); transactionalAdmin = false; });

  it.each(['create', 'update', 'delete'] as const)('checks %s against transactional permissions, not stale external permissions', async action => {
    const result = action === 'create' ? service.create(dto, 'actor') : action === 'update' ? service.update('target', { phone: null }, 'actor') : service.delete('target', 'actor');
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(provisioning.create).not.toHaveBeenCalled();
    expect(team.getProvisioningMembership).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('creates accounts through provisioning with the existing transaction', async () => {
    transactionalAdmin = true;
    team.getProvisioningMembership.mockResolvedValue({ teamId: 'team', organizationId: 'org' });
    await service.create({ ...dto, teamId: 'team' }, 'actor');
    expect(team.getProvisioningMembership).toHaveBeenCalledWith(tx, 'team');
    expect(provisioning.create).toHaveBeenCalledWith(tx, { ...dto, teamId: 'team' }, { teamId: 'team', organizationId: 'org' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('protects updates without name changes and deletion', async () => {
    transactionalAdmin = true;
    await service.update('target', { phone: null }, 'actor');
    await service.delete('target', 'actor');
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phone: null }) }));
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'target' } });
  });

  it('rejects direct reads by a non-admin', async () => {
    const read = jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({ isAdmin: false });
    await expect(service.findOne('target', 'actor')).rejects.toBeInstanceOf(ForbiddenException);
    read.mockResolvedValueOnce({ isAdmin: false });
    await expect(service.findAll({}, 'actor')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
