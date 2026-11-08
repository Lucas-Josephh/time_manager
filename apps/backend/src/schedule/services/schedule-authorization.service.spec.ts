import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScheduleAuthorizationService } from './schedule-authorization.service';

describe('ScheduleAuthorizationService', () => {
  const tx = { user: { findUnique: jest.fn() } };
  const service = new ScheduleAuthorizationService(
    tx as unknown as PrismaService,
  );

  beforeEach(() => jest.resetAllMocks());

  it.each([
    { isAdmin: true, managedTeams: [], managedOrganizations: [] },
    {
      isAdmin: false,
      managedTeams: [{ id: 'team' }],
      managedOrganizations: [],
    },
    { isAdmin: false, managedTeams: [], managedOrganizations: [{ id: 'org' }] },
  ])(
    'allows administrators and managers to create independent schedules: %p',
    async (user) => {
      tx.user.findUnique.mockResolvedValue(user);
      await expect(service.assertCanCreate('actor')).resolves.toBeUndefined();
    },
  );

  it.each([
    null,
    { isAdmin: false, managedTeams: [], managedOrganizations: [] },
  ])('refuses missing actors and regular members: %p', async (user) => {
    tx.user.findUnique.mockResolvedValue(user);
    await expect(service.assertCanCreate('actor')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
