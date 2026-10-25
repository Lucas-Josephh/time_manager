import { paginate } from '../common/pagination/paginate';
import {
  getOrganizationAncestors,
  getOrganizationDescendantIds,
} from '../organization/organization-hierarchy';
import { requireUnique } from '../common/validation/resource-validation';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartialSetTeamDto, QuerySetTeamDto, SetTeamDto } from './dto/team.dto';
import { Prisma } from '../generated/prisma/client';
import type { AvailableTeamUserDto } from './dto/available-team-user.dto';

export function buildTeamQueryFilter(
  filters: QuerySetTeamDto,
): Prisma.TeamWhereInput {
  const where: Prisma.TeamWhereInput = {};

  if (filters.name) {
    where.name = { contains: filters.name, mode: 'insensitive' };
  }

  if (filters.organizationId) {
    where.organizationId = filters.organizationId;
  }

  if (filters.managerId) {
    where.managerId = filters.managerId;
  }

  if (filters.memberId !== undefined) {
    where.members = {
      some: { id: filters.memberId },
    };
  }

  return where;
}

const relations = {
  manager: true,
  organization: true,
  members: true,
} as const;

type MemberScope = {
  canTransfer: boolean;
  // Undefined means unrestricted access for administrators.
  organizationId?: string;
};

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks if a user has permission to manage teams in the specified organization.
   * Admin users can manage teams in any organization. The manager of an existing
   * team can manage that team when its persisted context is supplied by the guard.
   *
   * @param organizationId
   * @param userId
   * @param team Current team scope and manager loaded from the database.
   */
  async assertCanManageTeams(
    organizationId: string,
    userId: string,
    team?: { organizationId: string; managerId: string | null },
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    // If the user does not exist, they cannot manage teams.
    if (!user) throw new ForbiddenException();

    // If the user is an admin, they can manage teams in any organization.
    if (user.isAdmin) return;

    // Team ownership only grants rights in that existing team's current scope.
    // This context comes from the guard's database lookup, never from the body.
    if (team?.organizationId === organizationId && team.managerId === userId)
      return;

    const ancestors = await getOrganizationAncestors(organizationId, this.prisma);
    if (ancestors.some((organization) => organization.managerId === userId))
      return;

    throw new ForbiddenException();
  }

  /**
   * Return users the actor can add or transfer, excluding current team members.
   *
   * @param teamId
   * @param userId
   */
  async findAvailableUsers(
    teamId: string,
    userId: string,
  ): Promise<AvailableTeamUserDto[]> {
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
      select: { organizationId: true, managerId: true },
    });

    await this.assertCanManageTeams(team.organizationId, userId, team);
    const scope = await this.getMemberScope(team.organizationId, userId);
    const organizationIds = scope.organizationId
      ? await getOrganizationDescendantIds(scope.organizationId, this.prisma)
      : undefined;
    const where = this.memberFilter(teamId, organizationIds, scope.canTransfer, false);

    return this.prisma.user.findMany({
      where,
      select: { id: true, firstname: true, lastname: true, image: true },
      orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Resolve membership before inserting a new user; its organization follows the team.
   *
   * @param tx - Prisma transaction client
   * @param teamId - Team ID
   *
   * @returns Object containing teamId and organizationId
   */
  async getProvisioningMembership(
    tx: Prisma.TransactionClient,
    teamId: string,
  ) {
    const team = await tx.team.findUniqueOrThrow({
      where: { id: teamId },
      select: { organizationId: true },
    });
    return { teamId, organizationId: team.organizationId };
  }

  async create(dto: SetTeamDto, userId?: string) {
    await this.validateName(dto);
    const data = {
      name: dto.name,
      managerId: dto.managerId,
      organizationId: dto.organizationId,
    };
    const memberIds = [
      ...new Set([
        ...(dto.memberIds ?? []),
        ...(dto.managerId ? [dto.managerId] : []),
      ]),
    ];
    if (memberIds.length === 0)
      return this.prisma.team.create({ data, include: relations });

    return this.prisma.$transaction(
      async (tx) => {
        const team = await tx.team.create({ data });
        const scope = await this.getMemberScope(dto.organizationId, userId, tx);
        await this.setMembers(
          tx,
          team.id,
          memberIds,
          scope,
          false,
        );
        return tx.team.findUniqueOrThrow({
          where: { id: team.id },
          include: relations,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  findOne(id: string) {
    return this.prisma.team.findUniqueOrThrow({
      where: { id },
      include: relations,
    });
  }

  findAll(filters: QuerySetTeamDto = {}) {
    const where = buildTeamQueryFilter(filters);
    return paginate(filters, (range) =>
      this.prisma.$transaction(
        [
          this.prisma.team.findMany({
            where,
            ...range,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            include: relations,
          }),
          this.prisma.team.count({ where }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }

  replace(id: string, dto: SetTeamDto, userId?: string) {
    return this.update(id, dto, userId);
  }

  async update(id: string, dto: PartialSetTeamDto, userId?: string) {
    await this.validateName(dto, id);
    const { memberIds, ...data } = dto;
    if (
      dto.organizationId === undefined &&
      memberIds === undefined &&
      !dto.managerId
    )
      return this.prisma.team.update({
        where: { id },
        data,
        include: relations,
      });

    return this.prisma.$transaction(
      async (tx) => {
        let organizationChanged = false;
        if (dto.organizationId !== undefined) {
          const currentTeam = await tx.team.findUniqueOrThrow({
            where: { id },
            select: { organizationId: true },
          });
          organizationChanged =
            currentTeam.organizationId !== dto.organizationId;
        }
        if (!organizationChanged && memberIds === undefined && !dto.managerId) {
          return tx.team.update({ where: { id }, data, include: relations });
        }

        const team = await tx.team.update({ where: { id }, data });
        const scope = await this.getMemberScope(team.organizationId, userId, tx);
        const retainedMembers =
          organizationChanged && memberIds === undefined
            ? await tx.user.findMany({
                where: { teamId: id },
                select: { id: true },
              })
            : [];
        const effectiveMemberIds = [
          ...new Set([
            ...(memberIds ?? retainedMembers.map((member) => member.id)),
            ...(team.managerId ? [team.managerId] : []),
          ]),
        ];
        await this.setMembers(
          tx,
          id,
          effectiveMemberIds,
          scope,
          memberIds !== undefined,
          true,
        );
        return tx.team.findUniqueOrThrow({ where: { id }, include: relations });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async validateName(
    dto: PartialSetTeamDto,
    id?: string,
  ): Promise<void> {
    if (dto.name !== undefined) {
      await requireUnique(
        this.prisma.team.findFirst({
          where: { name: dto.name, ...(id ? { id: { not: id } } : {}) },
          select: { id: true },
        }),
        'name',
      );
    }
  }

  /** Determine the actor's membership rights, independently of the candidate's team. */
  private async getMemberScope(
    organizationId: string,
    userId?: string,
    client: Pick<Prisma.TransactionClient, 'user' | 'organization'> = this.prisma,
  ): Promise<MemberScope> {
    // Internal callers without an actor get the most restrictive policy.
    if (!userId) return { canTransfer: false, organizationId };
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (!user) throw new ForbiddenException();
    if (user.isAdmin) return { canTransfer: true };

    const ancestors = await getOrganizationAncestors(organizationId, client);
    // The highest managed ancestor covers sibling teams inside the actor's organization.
    const managed = ancestors.filter(organization => organization.managerId === userId);
    const root = managed.at(-1);
    return root
      ? { canTransfer: true, organizationId: root.id }
      : { canTransfer: false, organizationId };
  }

  private memberFilter(
    teamId: string,
    organizationIds: string[] | undefined,
    canTransfer: boolean,
    allowExisting: boolean,
  ): Prisma.UserWhereInput {
    if (!canTransfer) {
      const available = { teamId: null, organizationId: { in: organizationIds } };
      return allowExisting ? { OR: [{ teamId }, available] } : available;
    }
    const transferable: Prisma.UserWhereInput = {
      ...(organizationIds ? {
        organizationId: { in: organizationIds },
        // An org manager cannot take a member away from a team outside their scope.
        OR: [
          { teamId: null },
          { team: { is: { organizationId: { in: organizationIds } } } },
        ],
      } : {}),
    };
    if (allowExisting) {
      return organizationIds ? { OR: [{ teamId }, transferable] } : {};
    }
    return { AND: [transferable, { OR: [{ teamId: null }, { teamId: { not: teamId } }] }] };
  }

  private async setMembers(
    tx: Prisma.TransactionClient,
    teamId: string,
    memberIds: string[],
    scope: MemberScope,
    replace: boolean,
    allowExisting = replace,
  ): Promise<void> {
    if (memberIds.length > 0) {
      const organizationIds = scope.organizationId
        ? await getOrganizationDescendantIds(scope.organizationId, tx)
        : undefined;
      const filter = this.memberFilter(
        teamId,
        organizationIds,
        scope.canTransfer,
        allowExisting,
      );
      // Remember source teams so a transferred manager does not keep managing their former team.
      const previousMembers = scope.canTransfer
        ? await tx.user.findMany({
            where: { id: { in: memberIds } },
            select: { id: true, teamId: true },
          })
        : [];
      const assigned = await tx.user.updateMany({
        where: { id: { in: memberIds }, ...filter },
        // Team membership never changes the user's organization.
        data: { teamId },
      });
      if (assigned.count !== memberIds.length) {
        const users = await tx.user.findMany({
          where: { id: { in: memberIds } },
          select: {
            id: true,
            firstname: true,
            lastname: true,
            teamId: true,
            organizationId: true,
            team: { select: { organizationId: true } },
          },
        });
        const usersById = new Map(users.map((user) => [user.id, user]));
        const unavailableMembers = memberIds.flatMap((id) => {
          const user = usersById.get(id);
          if (!user) return [{ id, reason: 'not_found' }];
          if (allowExisting && user.teamId === teamId) return [];

          let reason: string | undefined;
          if (!scope.canTransfer && user.teamId !== null && user.teamId !== teamId) {
            reason = 'already_in_team';
          } else if (organizationIds) {
            const userOutsideScope = user.organizationId === null ||
              !organizationIds.includes(user.organizationId);
            const sourceTeamOutsideScope = scope.canTransfer && user.team &&
              !organizationIds.includes(user.team.organizationId);
            if (userOutsideScope || sourceTeamOutsideScope) {
              reason = 'outside_organization';
            }
          }
          if (!reason) return [];
          return [{ id, firstname: user.firstname, lastname: user.lastname, reason }];
        });
        throw new ConflictException({
          message: 'team_members_unavailable',
          data: { unavailableMembers },
        });
      }
      const transferred = previousMembers.flatMap(user =>
        user.teamId && user.teamId !== teamId
          ? [{ userId: user.id, teamId: user.teamId }]
          : [],
      );
      if (transferred.length > 0) {
        await tx.team.updateMany({
          where: {
            id: { in: transferred.map(user => user.teamId) },
            managerId: { in: transferred.map(user => user.userId) },
          },
          data: { managerId: null },
        });
      }
    }
    if (replace) {
      await tx.user.updateMany({
        where: { teamId, id: { notIn: memberIds } },
        data: { teamId: null },
      });
    }
  }

  delete(id: string) {
    return this.prisma.team.delete({ where: { id } });
  }
}
