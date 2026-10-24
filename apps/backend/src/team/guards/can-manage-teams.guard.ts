import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard, type AuthRequest } from '../../auth/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResource } from '../../common/require-resource';
import { TeamService } from '../team.service';

const TEAM_MANAGEMENT = 'team_management';
type TeamManagementOptions = { teamId?: string };

@Injectable()
export class CanManageTeamsGuard implements CanActivate {
  constructor(
    private readonly teamService: TeamService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Checks if the user has management rights in the relevant organizations
   * based on the provided options.
   *
   * @param context
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      AuthRequest & {
        body?: { organizationId?: unknown };
        params: Record<string, string>;
        method: string;
      }
    >();

    // The decorator runs AuthGuard before this permission guard.
    const userId = request.session!.user.id;

    // Get the team management options from the decorator metadata, if any.
    const options = this.reflector.get<TeamManagementOptions>(
      TEAM_MANAGEMENT,
      context.getHandler(),
    );

    // Collect all organization IDs that need to be checked for management rights.
    const organizationIds = new Set<string>();
    let currentTeam:
      { organizationId: string; managerId: string | null } | undefined;
    if (options?.teamId) {
      currentTeam = await requireResource(
        this.prisma.team.findUnique({
          where: { id: request.params[options.teamId] },
          select: { organizationId: true, managerId: true },
        }),
      );
      organizationIds.add(currentTeam.organizationId);
    }

    // Guards run before DTO validation. Check a valid, trimmed destination;
    // invalid identifiers remain rejected by the validation pipe.
    if (request.method !== 'DELETE') {
      const destination = request.body?.organizationId;
      if (typeof destination === 'string' && destination.trim())
        organizationIds.add(destination.trim());
    }
    for (const organizationId of organizationIds) {
      await this.teamService.assertCanManageTeams(
        organizationId,
        userId,
        currentTeam,
      );
    }
    return true;
  }
}

/** Authenticate once, then check management rights in the relevant organizations. */
export function CanManageTeams(options: TeamManagementOptions = {}) {
  return applyDecorators(
    SetMetadata(TEAM_MANAGEMENT, options),
    UseGuards(AuthGuard, CanManageTeamsGuard),
  );
}
