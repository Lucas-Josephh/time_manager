import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Team } from '../../generated/prisma/client';
import { TeamAuthorizationService } from './team-authorization.service';
import { AvailableUsersQueryDto } from '../dto/team-actions.dto';

@Injectable()
export class TeamMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: TeamAuthorizationService,
  ) {}

  async assign(
    tx: Prisma.TransactionClient,
    teamId: string,
    memberIds: string[],
    actor: string,
    sourceTeamId?: string,
  ) {
    const team = await tx.team.findUniqueOrThrow({ where: { id: teamId } });
    await this.validateAssignment(tx, team, memberIds, actor, sourceTeamId);
    await this.assignValidated(tx, teamId, memberIds);
  }

  /** Only call after validating the complete operation, in the same transaction. */
  async assignValidated(tx: Prisma.TransactionClient, teamId: string, memberIds: string[]) {
    if (memberIds.length) await tx.user.updateMany({ where: { id: { in: [...new Set(memberIds)] } }, data: { teamId } });
  }

  async validateAssignment(
    tx: Prisma.TransactionClient,
    team: Pick<Team, 'id' | 'managerId' | 'organizationId'>,
    memberIds: string[],
    actor: string,
    sourceTeamId?: string,
  ) {
    const teamId = team.id;
    await this.authorization.assertCanManageMembers(team, actor, tx);
    if (sourceTeamId) {
      if (sourceTeamId === teamId) throw new ConflictException('same_team');
      const source = await tx.team.findUniqueOrThrow({
        where: { id: sourceTeamId },
      });
      await this.authorization.assertCanManageMembers(source, actor, tx);
    }
    const ids = [...new Set(memberIds)];
    const users = await tx.user.findMany({ where: { id: { in: ids } } });
    const scope = await this.authorization.getOrganizationScope(
      actor,
      true,
      tx,
    );
    const unavailableMembers = ids.flatMap((id) => {
      const user = users.find((u) => u.id === id);
      const reason = !user
        ? 'not_found'
        : team.managerId === id
          ? 'team_manager'
          : user.teamId !== (sourceTeamId ?? null)
            ? 'already_in_team'
            : !sourceTeamId &&
                scope !== null &&
                (!user.organizationId || !scope.includes(user.organizationId))
              ? 'outside_organization'
              : undefined;
      return reason ? [{ id, reason }] : [];
    });
    if (unavailableMembers.length)
      throw new ConflictException({
        message: 'team_members_unavailable',
        data: { unavailableMembers },
      });
  }

  add(teamId: string, ids: string[], actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.assign(tx, teamId, ids, actor);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  transfer(
    teamId: string,
    userId: string,
    sourceTeamId: string,
    actor: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.assign(tx, teamId, [userId], actor, sourceTeamId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  remove(teamId: string, userId: string, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const team = await tx.team.findUniqueOrThrow({ where: { id: teamId } });
        await this.authorization.assertCanManageMembers(team, actor, tx);
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.teamId !== teamId)
          throw new ConflictException('not_team_member');
        await tx.user.updateMany({
          where: { id: userId, teamId },
          data: { teamId: null },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async findAvailableUsers(actor: string, query: AvailableUsersQueryDto) {
    const target = await this.prisma.team.findUniqueOrThrow({
      where: { id: query.teamId },
    });
    await this.authorization.assertCanManageMembers(target, actor);
    const scope = await this.authorization.getOrganizationScope(actor, true);
    const teamScope = await this.authorization.getReadScope(actor);
    const where: Prisma.UserWhereInput =
      query.usage === 'transfer'
        ? { teamId: { not: query.teamId }, team: { is: teamScope } }
        : {
            teamId: null,
            ...(scope === null ? {} : { organizationId: { in: scope } }),
          };
    return this.prisma.user.findMany({
      where: { AND: [where, { id: { not: target.managerId ?? '' } }] },
      select: { id: true, firstname: true, lastname: true, image: true },
      orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }, { id: 'asc' }],
    });
  }
}
