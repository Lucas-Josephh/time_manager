import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Team } from '../../generated/prisma/client';
import { OrganizationHierarchyService } from '../../organization/services/organization-hierarchy.service';

@Injectable()
export class TeamAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly hierarchy: OrganizationHierarchyService,
  ) {}

  /**
   * Assert that the actor can create a team in the given organization.
   *
   * @param organizationId
   * @param actor
   * @param tx
   */
  async assertCanCreate(
    organizationId: string,
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (await this.auth.isAdmin(actor, tx)) return;

    if (await this.hierarchy.isManagedBy(organizationId, actor, tx)) return;

    throw new ForbiddenException();
  }

  /**
   * Assert that the actor can manage members of the given team.
   *
   * @param team
   * @param actor
   * @param tx
   */
  async assertCanManageMembers(
    team: Pick<Team, 'managerId' | 'organizationId'>,
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (team.managerId === actor) return;
    await this.assertCanCreate(team.organizationId, actor, tx);
  }

  /**
   * Assert that the actor can change the manager of the given team.
   *
   * @param team
   * @param actor
   * @param tx
   */
  async assertCanChangeManager(
    team: Team,
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    await this.assertCanCreate(team.organizationId, actor, tx);
  }

  /**
   * Assert that the actor can read the given team.
   *
   * @param team
   * @param actor
   * @param tx
   */
  async assertCanRead(
    team: Pick<Team, 'managerId' | 'organizationId'>,
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    await this.assertCanManageMembers(team, actor, tx);
  }

  /**
   * Assert that the actor can update the given team, including changing its organization.
   *
   * @param team
   * @param actor
   * @param destinationOrganizationId
   * @param tx
   */
  async assertCanUpdate(
    team: Pick<Team, 'managerId' | 'organizationId'>,
    actor: string,
    destinationOrganizationId?: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    await this.assertCanManageMembers(team, actor, tx);

    if (
      destinationOrganizationId &&
      destinationOrganizationId !== team.organizationId
    ) {
      // Move to another organization requires permission to create in both the source and destination organizations
      await this.assertCanCreate(team.organizationId, actor, tx);
      await this.assertCanCreate(destinationOrganizationId, actor, tx);
    }
  }

  /**
   * Assert that the actor can delete the given team.
   *
   * @param team
   * @param actor
   * @param tx
   */
  async assertCanDelete(
    team: Pick<Team, 'organizationId'>,
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    await this.assertCanCreate(team.organizationId, actor, tx);
  }

  /**
   * Get the organization scope for the given actor, including all organizations
   * they manage and optionally the organizations of teams they manage.
   *
   * @param actor
   * @param includeTeams
   * @param tx
   */
  async getOrganizationScope(
    actor: string,
    includeTeams: boolean,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<string[] | null> {
    if (await this.auth.isAdmin(actor, tx)) return null;
    const roots = (
      await tx.organization.findMany({
        where: { managerId: actor },
        select: { id: true },
      })
    ).map((o) => o.id);
    if (includeTeams)
      roots.push(
        ...(
          await tx.team.findMany({
            where: { managerId: actor },
            select: { organizationId: true },
          })
        ).map((t) => t.organizationId),
      );
    const organizations = await tx.organization.findMany({
      where: { id: { in: [...new Set(roots)] } },
    });
    const descendants = await this.hierarchy.getOrganizationsWithChildren(organizations, tx);
    return descendants.map(({ id }) => id);
  }

  /**
   * Get the read scope for the given actor, including all teams in organizations
   *
   * @param actor
   * @param tx
   */
  async getReadScope(
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Prisma.TeamWhereInput> {
    const ids = await this.getOrganizationScope(actor, false, tx);
    if (ids === null) return {};
    const managed = await tx.team.findMany({
      where: { managerId: actor },
      select: { id: true },
    });
    if (!ids.length && !managed.length) throw new ForbiddenException();
    return { OR: [{ organizationId: { in: ids } }, { managerId: actor }] };
  }
}
