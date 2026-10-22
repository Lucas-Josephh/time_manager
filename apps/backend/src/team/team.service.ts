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

  async assertCanCreate(organizationId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    // If the user does not exist, they cannot create a team.
    if (!user) throw new ForbiddenException();

    // If the user is an admin, they can create a team in any organization.
    if (user.isAdmin) return;

    const visited = new Set<string>();
    let currentId: string | null = organizationId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const organization: {
        managerId: string | null;
        parentId: string | null;
      } | null = await this.prisma.organization.findUnique({
        where: { id: currentId },
        select: { managerId: true, parentId: true },
      });
      if (!organization) break;
      if (organization.managerId === userId) return;
      currentId = organization.parentId;
    }
    throw new ForbiddenException();
  }

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

    const organizationIds = new Set([team.organizationId]);
    let frontier = [team.organizationId];
    while (frontier.length > 0) {
      const children = await this.prisma.organization.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      frontier = [];
      for (const child of children) {
        if (!organizationIds.has(child.id)) {
          organizationIds.add(child.id);
          frontier.push(child.id);
        }
      }
    }

    return this.prisma.user.findMany({
      where: { organizationId: { in: [...organizationIds] }, teamId: null },
      select: { id: true, firstname: true, lastname: true, image: true },
      orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }, { id: 'asc' }],
    });
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

    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({ data });
      await this.setMembers(tx, team.id, dto.organizationId, memberIds, false);
      return requireResource(
        tx.team.findUnique({
          where: { id: team.id },
          include: relations,
        }),
      );
    });
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
    return this.prisma.team.findMany({
      where: buildTeamQueryFilter(filters),
      orderBy: { name: 'asc' },
      include: relations,
    });
  }

  replace(id: string, dto: SetTeamDto) {
    return this.update(id, dto);
  }

  async update(id: string, dto: PartialSetTeamDto) {
    await this.validateName(dto, id);
    const { memberIds, ...data } = dto;
    if (memberIds === undefined && !dto.managerId)
      return this.prisma.team.update({
        where: { id },
        data,
        include: relations,
      });

    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.update({ where: { id }, data });
      const effectiveMemberIds = [
        ...new Set([
          ...(memberIds ?? []),
          ...(team.managerId ? [team.managerId] : []),
        ]),
      ];
      await this.setMembers(
        tx,
        id,
        team.organizationId,
        effectiveMemberIds,
        memberIds !== undefined,
        true,
      );
      return requireResource(
        tx.team.findUnique({
          where: { id: team.id },
          include: relations,
        }),
      );
    });
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
      const organizationIds = new Set([organizationId]);
      let frontier = [organizationId];
      while (frontier.length > 0) {
        const children = await tx.organization.findMany({
          where: { parentId: { in: frontier } },
          select: { id: true },
        });
        frontier = [];
        for (const child of children) {
          if (!organizationIds.has(child.id)) {
            organizationIds.add(child.id);
            frontier.push(child.id);
          }
        }
      }
      const assigned = await tx.user.updateMany({
        where: {
          id: { in: memberIds },
          ...(allowExisting
            ? { OR: [{ teamId: null }, { teamId }] }
            : { teamId: null }),
          organizationId: { in: [...organizationIds] },
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
                  !organizationIds.has(user.organizationId)
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
