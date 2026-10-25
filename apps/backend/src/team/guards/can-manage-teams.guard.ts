import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../auth/guards/auth.guard';
import type { AuthRequest } from '../../auth/auth.types';
import { OrganizationService } from '../../organization/organization.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TeamService } from '../team.service';

const TEAM_MANAGEMENT = 'team_management';
type TeamManagementOptions = { teamId?: string };
type TeamManagementRequest = AuthRequest & {
  params: Record<string, string>;
  body?: { organizationId?: unknown };
  method: string;
};

@Injectable()
export class CanManageTeamsGuard implements CanActivate {
  constructor(
    private readonly teamService: TeamService,
    private readonly organizationService: OrganizationService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Check management rights on the existing team or the requested organization.
   *
   * Creating a team requires organization management rights on its destination.
   * Moving a team requires organization management rights on both its source
   * and destination. Team management rights suffice only when staying in place.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TeamManagementRequest>();
    const userId = request.session!.user.id;

    const { teamId } =
      this.reflector.get<TeamManagementOptions>(
        TEAM_MANAGEMENT,
        context.getHandler(),
      ) ?? {};

    const bodyOrganizationId = request.body?.organizationId;

    // Normalize the target organization ID from the request body.
    const targetOrganizationId =
      typeof bodyOrganizationId === 'string'
        ? bodyOrganizationId.trim()
        : bodyOrganizationId;

    // Check if the request has a valid target organization ID for creation or moving.
    const hasTargetOrganizationId =
      request.method !== 'DELETE' &&
      typeof targetOrganizationId === 'string' &&
      targetOrganizationId.length > 0;

    // Treatment on existing team, either for management or moving to a different organization.
    if (teamId) {
      const team = await this.prisma.team.findUniqueOrThrow({
        where: { id: request.params[teamId] },
        select: { organizationId: true, managerId: true },
      });

      if (
        !hasTargetOrganizationId ||
        targetOrganizationId === team.organizationId
      ) {
        // When staying in place, team management rights suffice.
        await this.teamService.assertCanManageTeams(team, userId);
        return true;
      }

      // Check management rights on the source organization for team moving.
      await this.organizationService.assertCanManageOrganizations(
        team.organizationId,
        userId,
      );
    }

    // The validation pipe handles missing or malformed identifiers after this guard.
    if (!hasTargetOrganizationId) return true;

    // Check management rights on the target organization for team creation or moving.
    await this.organizationService.assertCanManageOrganizations(
      targetOrganizationId,
      userId,
    );
    return true;
  }
}

/**
 * Authenticate once, then check team management rights.
 *
 * @param options - Route parameter containing the ID of an existing team.
 * Otherwise, without teamId, check the requested organization for creation.
 */
export function CanManageTeams(options: TeamManagementOptions = {}) {
  return applyDecorators(
    SetMetadata(TEAM_MANAGEMENT, options),
    UseGuards(AuthGuard, CanManageTeamsGuard),
  );
}
