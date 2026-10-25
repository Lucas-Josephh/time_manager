import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { TeamAuthorizationService } from './team-authorization.service';
import { TeamMembersService } from './team-members.service';
import {
  PartialSetTeamDto,
  QuerySetTeamDto,
  SetTeamDto,
} from '../dto/team.dto';
import { AvailableUsersQueryDto } from '../dto/team-actions.dto';
import { paginate } from '../../common/pagination/paginate';
const relations = { manager: true, organization: true, members: true } as const;
const serializable = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
};
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: TeamAuthorizationService,
    private readonly members: TeamMembersService,
  ) {}

  /**
   * Return the team and organization IDs for provisioning a new user, given a team ID. Throws if the team does not exist.
   *
   * @param tx
   * @param teamId
   */
  async getProvisioningMembership(
    tx: Prisma.TransactionClient,
    teamId: string,
  ): Promise<{ teamId: string; organizationId: string }> {
    const team = await tx.team.findUniqueOrThrow({
      where: { id: teamId },
      select: { organizationId: true },
    });
    return { teamId, organizationId: team.organizationId };
  }

  /**
   * Create a new team with optional manager and members, after checking
   * authorization and validating the request. The operation is performed in a
   * single transaction to ensure consistency.
   *
   * @param dto
   * @param actor
   */
  create(dto: SetTeamDto, actor: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.authorization.assertCanCreate(dto.organizationId, actor, tx);

      if (dto.managerId && dto.memberIds?.includes(dto.managerId))
        throw new ConflictException('manager_cannot_be_member');

      if (dto.managerId)
        await tx.user.findUniqueOrThrow({ where: { id: dto.managerId } });

      const requestedIds = dto.memberIds ?? [];

      if (new Set(requestedIds).size !== requestedIds.length)
        throw new ConflictException('duplicate_member');

      const target = {
        id: '',
        organizationId: dto.organizationId,
        managerId: dto.managerId ?? null,
      };
      // Resolve source teams from stored memberships inside the same transaction.
      const users = await tx.user.findMany({
        where: { id: { in: requestedIds } },
        select: { id: true, teamId: true },
      });
      const groups = new Map<string | null, string[]>();
      for (const id of requestedIds) {
        const sourceTeamId = users.find((user) => user.id === id)?.teamId ?? null;
        const ids = groups.get(sourceTeamId) ?? [];
        ids.push(id);
        groups.set(sourceTeamId, ids);
      }
      for (const [sourceTeamId, ids] of groups)
        await this.members.validateAssignment(
          tx,
          target,
          ids,
          actor,
          sourceTeamId ?? undefined,
        );
      const team = await tx.team.create({
        data: {
          name: dto.name,
          organizationId: dto.organizationId,
          managerId: dto.managerId,
        },
      });
      await this.members.assignValidated(tx, team.id, requestedIds);
      return tx.team.findUniqueOrThrow({
        where: { id: team.id },
        include: relations,
      });
    }, serializable);
  }

  update(id: string, dto: PartialSetTeamDto, actor: string) {
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findUniqueOrThrow({ where: { id } });
      await this.authorization.assertCanUpdate(
        team,
        actor,
        dto.organizationId,
        tx,
      );
      return tx.team.update({
        where: { id },
        data: { name: dto.name, organizationId: dto.organizationId },
        include: relations,
      });
    }, serializable);
  }

  setManager(id: string, managerId: string | null, actor: string) {
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findUniqueOrThrow({ where: { id } });
      await this.authorization.assertCanChangeManager(team, actor, tx);
      if (managerId) {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: managerId },
        });
        if (user.teamId === id)
          throw new ConflictException('manager_cannot_be_member');
      }
      return tx.team.update({
        where: { id },
        data: { managerId },
        include: relations,
      });
    }, serializable);
  }

  async findOne(id: string, actor: string) {
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id },
      include: relations,
    });
    await this.authorization.assertCanRead(team, actor);
    return team;
  }

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

  async findAll(filters: QuerySetTeamDto, actor: string) {
    const scope = await this.authorization.getReadScope(actor);
    const filtersWhere = this.buildWhereClause(filters);
    const where = Object.keys(scope).length
      ? { AND: [filtersWhere, scope] }
      : filtersWhere;
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

  async findAvailableUsers(actor: string, query: AvailableUsersQueryDto) {
    if (query.usage !== 'manager')
      return this.members.findAvailableUsers(actor, query);
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: query.teamId },
    });
    await this.authorization.assertCanChangeManager(team, actor);
    return this.prisma.user.findMany({
      where: { OR: [{ teamId: null }, { teamId: { not: team.id } }] },
      select: { id: true, firstname: true, lastname: true, image: true },
      orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }, { id: 'asc' }],
    });
  }

  delete(id: string, actor: string) {
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findUniqueOrThrow({ where: { id } });
      await this.authorization.assertCanDelete(team, actor, tx);
      if (await tx.user.count({ where: { teamId: id } }))
        throw new ConflictException('team_has_members');
      return tx.team.delete({ where: { id } });
    }, serializable);
  }
}
