import { AuthService } from '../auth/auth.service';
import { ForbiddenException } from '@nestjs/common';
import type { Prisma, Team } from '../generated/prisma/client';
import { OrganizationHierarchy } from '../organization/organization-hierarchy';

export type TeamManagementScope = Pick<Team, 'organizationId' | 'managerId'>;

export type MemberScope = {
  // Indicates whether the user can transfer members from other organizations into this team.
  canTransfer: boolean;
  // Without organizationId, administrators can choose from all organizations.
  organizationId?: string;
};

/** Resolves team permissions and the users accessible to the current actor. */
export class TeamPermissions {
  private readonly hierarchy: OrganizationHierarchy;

  constructor(
    private readonly prisma: Pick<
      Prisma.TransactionClient,
      'user' | 'team' | 'organization'
    >,
    private readonly authService: AuthService,
  ) {
    this.hierarchy = new OrganizationHierarchy(prisma);
  }

  /**
   * Check if the user is the manager of the team, based on the provided team scope.
   *
   * @param team The team management scope containing organizationId and managerId.
   * @param userId The ID of the user to check against the team's managerId.
   */
  isManagedBy(team: TeamManagementScope, userId: string): boolean {
    return team.managerId === userId;
  }

  /**
   * Check if the user is an administrator, manages the team's organization,
   * or manages the team itself.
   *
   * @param team Current team scope and manager loaded from the database.
   * @param userId The ID of the user to check.
   */
  async assertCanManageTeams(
    team: TeamManagementScope,
    userId: string,
  ): Promise<void> {
    if (await this.authService.isAdmin(userId, this.prisma)) return;
    if (await this.hierarchy.isManagedBy(team.organizationId, userId)) return;

    // The team context comes from the guard's database lookup.
    if (this.isManagedBy(team, userId)) return;

    throw new ForbiddenException();
  }

  /**
   * Define the scope of members that can be added to a team, based on the user's permissions.
   *
   * @param organizationId The ID of the organization to check.
   * @param userId The ID of the user to check. If not provided, only free members of the organization are allowed.
   * @returns A MemberScope object indicating whether the user can transfer members and the organization ID they can manage.
   * @throws ForbiddenException if the current user does not exist.
   */
  async getMemberScope(
    organizationId: string,
    userId?: string,
  ): Promise<MemberScope> {
    // Without a current user, only unassigned members of this organization are allowed.
    if (!userId) return { canTransfer: false, organizationId };

    if (await this.authService.isAdmin(userId, this.prisma))
      return { canTransfer: true };

    const parents = await this.hierarchy.getOrganizationParents(organizationId);
    // The highest managed parent covers all accessible branches.
    const managed = parents.filter(
      (organization) => organization.managerId === userId,
    );
    const root = managed.at(-1);
    return root
      ? { canTransfer: true, organizationId: root.id }
      : { canTransfer: false, organizationId };
  }

  /**
   * Get a filter for available users based on the user's permissions.
   *
   * @param userId
   */
  async getAvailableUsersFilter(
    userId: string,
  ): Promise<Prisma.UserWhereInput> {
    if (await this.authService.isAdmin(userId, this.prisma)) return {};

    const organizations = await this.prisma.organization.findMany({
      where: { managerId: userId },
      select: { id: true },
    });

    const teams = await this.prisma.team.findMany({
      where: { managerId: userId },
      select: { organizationId: true },
    });

    if (organizations.length === 0 && teams.length === 0)
      throw new ForbiddenException();

    const expand = async (roots: string[]) => {
      const ids = new Set<string>();
      for (const root of new Set(roots)) {
        if (ids.has(root)) continue;
        for (const id of await this.hierarchy.getOrganizationChildrenIds(root))
          ids.add(id);
      }
      return [...ids];
    };
    const managedOrganizationIds = await expand(
      organizations.map(({ id }) => id),
    );
    const teamOrganizationIds = await expand(
      teams.map(({ organizationId }) => organizationId),
    );
    const scopes: Prisma.UserWhereInput[] = [];
    if (managedOrganizationIds.length > 0) {
      scopes.push({
        organizationId: { in: managedOrganizationIds },
        OR: [
          { teamId: null },
          { team: { is: { organizationId: { in: managedOrganizationIds } } } },
        ],
      });
    }
    if (teamOrganizationIds.length > 0) {
      scopes.push({
        organizationId: { in: teamOrganizationIds },
        teamId: null,
      });
    }
    return { OR: scopes };
  }

  /**
   * Find users available for team assignment based on the user's permissions.
   *
   * @param userId
   */
  async findAvailableUsers(userId: string) {
    const where = await this.getAvailableUsersFilter(userId);
    return this.prisma.user.findMany({
      where,
      select: { id: true, firstname: true, lastname: true, image: true },
      orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }, { id: 'asc' }],
    });
  }
}
