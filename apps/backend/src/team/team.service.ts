import { AuthService } from '../auth/auth.service';
import { TeamPermissions, type TeamManagementScope } from './team-permissions';
import { TeamMembers } from './team-members';
import { paginate } from '../common/pagination/paginate';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartialSetTeamDto, QuerySetTeamDto, SetTeamDto } from './dto/team.dto';
import { Prisma } from '../generated/prisma/client';
import type { AvailableTeamUserDto } from './dto/available-team-user.dto';

const relations = {
  manager: true,
  organization: true,
  members: true,
} as const;

@Injectable()
export class TeamService {
  private readonly permissions: TeamPermissions;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {
    this.permissions = new TeamPermissions(prisma, authService);
  }

  /**
   * Check if the user is an administrator, manages the team's organization,
   * or manages the team itself.
   *
   * @param team Current team scope and manager loaded from the database.
   * @param userId The ID of the user to check.
   */
  assertCanManageTeams(
    team: TeamManagementScope,
    userId: string,
  ): Promise<void> {
    return this.permissions.assertCanManageTeams(team, userId);
  }

  /** Return candidates across all scopes the current actor can manage. */
  findAvailableUsers(userId: string): Promise<AvailableTeamUserDto[]> {
    return this.permissions.findAvailableUsers(userId);
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
    const data = {
      name: dto.name,
      managerId: dto.managerId,
      organizationId: dto.organizationId,
    };

    // Resolve the list of member IDs to add to the team, ensuring uniqueness and including the manager if specified.
    const memberIds = [
      ...new Set([
        ...(dto.memberIds ?? []),
        ...(dto.managerId ? [dto.managerId] : []),
      ]),
    ];

    // If no members are specified, create the team without adding members in a transaction.
    if (memberIds.length === 0)
      return this.prisma.team.create({ data, include: relations });

    // Create a new team and add members in a transaction,
    // ensuring that the user has the necessary permissions to manage the team and its members.
    return this.prisma.$transaction(
      async (tx) => {
        const team = await tx.team.create({ data });

        const permissions = new TeamPermissions(tx, this.authService);
        const members = new TeamMembers(tx);

        const scope = await permissions.getMemberScope(
          dto.organizationId,
          userId,
        );

        await members.setMembers(team.id, memberIds, scope, {
          replaceExisting: false,
        });

        return tx.team.findUniqueOrThrow({
          where: { id: team.id },
          include: relations,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async update(id: string, dto: PartialSetTeamDto, userId?: string) {
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
        const permissions = new TeamPermissions(tx, this.authService);
        const members = new TeamMembers(tx);
        const scope = await permissions.getMemberScope(
          team.organizationId,
          userId,
        );
        // Moving a team without a member list preserves its current members.
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
        await members.setMembers(id, effectiveMemberIds, scope, {
          replaceExisting: memberIds !== undefined,
        });
        return tx.team.findUniqueOrThrow({ where: { id }, include: relations });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Return a single team by ID, including its relations.
   *
   * @param id
   */

  findOne(id: string) {
    return this.prisma.team.findUniqueOrThrow({
      where: { id },
      include: relations,
    });
  }

  /**
   * Build a Prisma where clause for filtering teams based on the provided filters.
   *
   * @param filters
   */
  buildWhereClause(filters: QuerySetTeamDto): Prisma.TeamWhereInput {
    const where: Prisma.TeamWhereInput = {};

    // Search by name (case-insensitive) if provided
    if (filters.name)
      where.name = { contains: filters.name, mode: 'insensitive' };

    // Filter by organization ID if provided
    if (filters.organizationId) where.organizationId = filters.organizationId;

    // Filter by manager ID if provided
    if (filters.managerId) where.managerId = filters.managerId;

    // Search for teams that have a specific member ID if provided
    if (filters.memberId !== undefined) {
      where.members = { some: { id: filters.memberId } };
    }

    return where;
  }

  /**
   * Return a paginated list of teams, optionally filtered by name, organization ID, manager ID, or member ID.
   *
   * @param filters
   */
  findAll(filters: QuerySetTeamDto = {}) {
    const where: Prisma.TeamWhereInput = this.buildWhereClause(filters);

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

  delete(id: string) {
    return this.prisma.team.delete({ where: { id } });
  }
}
