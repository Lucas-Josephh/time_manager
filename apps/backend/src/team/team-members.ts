import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { OrganizationHierarchy } from '../organization/organization-hierarchy';
import type { MemberScope } from './team-permissions';

type SetMembersOptions = {
  replaceExisting: boolean;
};

const memberSelection = {
  id: true,
  firstname: true,
  lastname: true,
  teamId: true,
  organizationId: true,
  team: { select: { organizationId: true } },
} satisfies Prisma.UserSelect;

type RequestedMember = Prisma.UserGetPayload<{
  select: typeof memberSelection;
}>;
type UnavailableReason = 'already_in_team' | 'outside_organization';

/** Validates and writes team membership using the supplied transaction client. */
export class TeamMembers {
  private readonly hierarchy: OrganizationHierarchy;

  constructor(
    private readonly prisma: Pick<
      Prisma.TransactionClient,
      'user' | 'team' | 'organization'
    >,
  ) {
    this.hierarchy = new OrganizationHierarchy(prisma);
  }

  /**
   * Validate the complete member list before writing anything.
   * Call inside a serializable transaction so membership cannot change between
   * validation and assignment. Existing members can always be retained.
   */
  async setMembers(
    teamId: string,
    memberIds: string[],
    scope: MemberScope,
    { replaceExisting }: SetMembersOptions,
  ): Promise<void> {
    if (memberIds.length > 0) {
      const members = await this.prisma.user.findMany({
        where: { id: { in: memberIds } },
        select: memberSelection,
      });
      const organizationIds = scope.organizationId
        ? new Set(
            await this.hierarchy.getOrganizationChildrenIds(
              scope.organizationId,
            ),
          )
        : undefined;

      this.validateMembers(teamId, memberIds, members, scope, organizationIds);

      // Assignment changes only the team; each user's organization is preserved.
      await this.prisma.user.updateMany({
        where: { id: { in: memberIds } },
        data: { teamId },
      });
      await this.removeTransferredManagers(teamId, members);
    }

    if (replaceExisting) {
      await this.prisma.user.updateMany({
        where: { teamId, id: { notIn: memberIds } },
        data: { teamId: null },
      });
    }
  }

  /**
   * Validate that each member is available for assignment to the team,
   * based on the user's permissions and the member's current team and organization.
   *
   * @param teamId
   * @param memberIds
   * @param members
   * @param scope
   * @param organizationIds
   * @private
   */
  private validateMembers(
    teamId: string,
    memberIds: string[],
    members: RequestedMember[],
    scope: MemberScope,
    organizationIds: Set<string> | undefined,
  ): void {
    const membersById = new Map(members.map((member) => [member.id, member]));
    const unavailableMembers = [];

    for (const id of memberIds) {
      const member = membersById.get(id);
      if (!member) {
        unavailableMembers.push({ id, reason: 'not_found' });
        continue;
      }

      const reason = this.getUnavailableReason(
        member,
        teamId,
        scope,
        organizationIds,
      );
      if (reason) {
        unavailableMembers.push({
          id,
          firstname: member.firstname,
          lastname: member.lastname,
          reason,
        });
      }
    }

    if (unavailableMembers.length > 0) {
      throw new ConflictException({
        message: 'team_members_unavailable',
        data: { unavailableMembers },
      });
    }
  }

  /**
   * Determine the reason a member is unavailable for assignment to the team.
   *
   * @param member
   * @param teamId
   * @param scope
   * @param organizationIds
   * @private
   */
  private getUnavailableReason(
    member: RequestedMember,
    teamId: string,
    scope: MemberScope,
    organizationIds: Set<string> | undefined,
  ): UnavailableReason | undefined {
    // Retaining a member does not require eligibility for a new assignment.
    if (member.teamId === teamId) return;
    if (member.teamId !== null && !scope.canTransfer) return 'already_in_team';

    // Administrators have no organization restriction.
    if (!organizationIds) return;
    if (!member.organizationId || !organizationIds.has(member.organizationId))
      return 'outside_organization';

    // A transfer also requires rights over the source team's organization.
    if (
      member.teamId !== null &&
      (!member.team || !organizationIds.has(member.team.organizationId))
    )
      return 'outside_organization';
  }

  private async removeTransferredManagers(
    teamId: string,
    members: RequestedMember[],
  ): Promise<void> {
    const previousTeams = [];
    for (const member of members) {
      if (member.teamId !== null && member.teamId !== teamId) {
        previousTeams.push({ id: member.teamId, managerId: member.id });
      }
    }
    if (previousTeams.length === 0) return;

    await this.prisma.team.updateMany({
      where: { OR: previousTeams },
      data: { managerId: null },
    });
  }
}
