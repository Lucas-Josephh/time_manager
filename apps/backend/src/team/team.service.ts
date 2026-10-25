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
import { requireResource } from '../common/require-resource';
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
   * Return users that are available to be added to a team, i.e., users that are
   * not already assigned to a team and belong to the same organization or
   * its descendants.
   *
   * @param id
   * @param userId
   */
  async findAvailableUsers(
    id: string,
    userId: string,
  ): Promise<AvailableTeamUserDto[]> {
    const team = await requireResource(
      this.prisma.team.findUnique({
        where: { id },
        select: { organizationId: true, managerId: true },
      }),
    );

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (!user || (team.managerId !== userId && !user.isAdmin)) {
      throw new ForbiddenException();
    }

    const organizationIds = await getOrganizationDescendantIds(
      team.organizationId,
      this.prisma,
    );

    return this.prisma.user.findMany({
      where: { organizationId: { in: organizationIds }, teamId: null },
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
    const team = await requireResource(
      tx.team.findUnique({
        where: { id: teamId },
        select: { organizationId: true },
      }),
    );
    return { teamId, organizationId: team.organizationId };
  }

  async create(dto: SetTeamDto) {
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
        await this.setMembers(
          tx,
          team.id,
          dto.organizationId,
          memberIds,
          false,
        );
        return requireResource(
          tx.team.findUnique({
            where: { id: team.id },
            include: relations,
          }),
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  findOne(id: string) {
    return requireResource(
      this.prisma.team.findUnique({
        where: { id },
        include: relations,
      }),
    );
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

  replace(id: string, dto: SetTeamDto) {
    return this.update(id, dto);
  }

  async update(id: string, dto: PartialSetTeamDto) {
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
          const currentTeam = await requireResource(
            tx.team.findUnique({
              where: { id },
              select: { organizationId: true },
            }),
          );
          organizationChanged =
            currentTeam.organizationId !== dto.organizationId;
        }
        if (!organizationChanged && memberIds === undefined && !dto.managerId) {
          return tx.team.update({ where: { id }, data, include: relations });
        }

        const team = await tx.team.update({ where: { id }, data });
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
          dto.organizationId ?? team.organizationId,
          effectiveMemberIds,
          memberIds !== undefined,
          true,
        );
        return requireResource(
          tx.team.findUnique({ where: { id }, include: relations }),
        );
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

  private async setMembers(
    tx: Prisma.TransactionClient,
    teamId: string,
    organizationId: string,
    memberIds: string[],
    replace: boolean,
    allowExisting = replace,
  ): Promise<void> {
    if (memberIds.length > 0) {
      const organizationIds = await getOrganizationDescendantIds(
        organizationId,
        tx,
      );
      const assigned = await tx.user.updateMany({
        where: {
          id: { in: memberIds },
          ...(allowExisting
            ? { OR: [{ teamId: null }, { teamId }] }
            : { teamId: null }),
          organizationId: { in: organizationIds },
        },
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
          },
        });
        const usersById = new Map(users.map((user) => [user.id, user]));
        const unavailableMembers = memberIds.flatMap((id) => {
          const user = usersById.get(id);
          if (!user) return [{ id, reason: 'not_found' }];
          const reason =
            user.teamId !== null && user.teamId !== teamId
              ? 'already_in_team'
              : user.organizationId === null ||
                  !organizationIds.includes(user.organizationId)
                ? 'outside_organization'
                : null;
          return reason
            ? [
                {
                  id,
                  firstname: user.firstname,
                  lastname: user.lastname,
                  reason,
                },
              ]
            : [];
        });
        throw new ConflictException({
          message: 'team_members_unavailable',
          data: { unavailableMembers },
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
