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
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationService } from '../organization.service';
import type { AuthRequest } from '../../auth/auth.types';

const ORGANIZATION_MANAGEMENT = 'organization_management';
type OrganizationManagementOptions = { organizationId?: string };
type OrganizationManagementRequest = AuthRequest & {
  params: Record<string, string>;
  body?: { parentId?: unknown };
  method: string;
};

@Injectable()
export class CanManageOrganizationsGuard implements CanActivate {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Check management rights on the existing organization or the requested parent.
   *
   * Moving an organization requires rights on both the organization itself and
   * its new parent: managing either one alone does not authorize the move.
   *
   * These checks may revisit shared ancestors or repeat the admin lookup.
   * An unchanged parent needs no second check. Creating or moving to a root
   * requires administrator privileges.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<OrganizationManagementRequest>();

    const userId = request.session!.user.id;

    // Get the organizationId from the metadata to fetch the organization from the request params if it exists.
    const { organizationId } = this.reflector.get<OrganizationManagementOptions>(
      ORGANIZATION_MANAGEMENT,
      context.getHandler(),
    );

    // Fetch the destination parentId from the request body, if it exists.
    const parentId = request.body?.parentId;
    const parentOrganizationId = typeof parentId === 'string' ? parentId.trim() : parentId;

    // If the request is for an existing organization, check if the user can manage it.
    if (organizationId) {
      const id = request.params[organizationId];
      const { parentId: currentParentId } =
        await this.prisma.organization.findUniqueOrThrow({
          where: { id },
          select: { parentId: true },
        });
      await this.organizationService.assertCanManageOrganizations(id, userId);

      // If the request is a DELETE or the parent is unchanged, no further checks are needed.
      if (
        request.method === 'DELETE' ||
        parentOrganizationId === undefined ||
        parentOrganizationId === currentParentId
      )
        return true;
    }

    // Leave malformed identifiers to the validation pipe.
    if (
      parentOrganizationId != null &&
      (typeof parentOrganizationId !== 'string' || !parentOrganizationId)
    )
      return true;

    // A null or omitted parent creates a root and requires admin rights.
    await this.organizationService.assertCanManageOrganizations(
      parentOrganizationId ?? null,
      userId,
    );

    return true;
  }
}

/** Authenticate, then check the existing organization or the requested parent. */
export function CanManageOrganizations(
  options: OrganizationManagementOptions = {},
) {
  return applyDecorators(
    SetMetadata(ORGANIZATION_MANAGEMENT, options),
    UseGuards(AuthGuard, CanManageOrganizationsGuard),
  );
}
