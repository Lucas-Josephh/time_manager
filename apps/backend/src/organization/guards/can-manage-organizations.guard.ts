import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard, type AuthRequest } from '../../auth/guards/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationService } from '../organization.service';

const ORGANIZATION_MANAGEMENT = 'organization_management';
type OrganizationManagementOptions = { organizationId?: string };

@Injectable()
export class CanManageOrganizationsGuard implements CanActivate {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Checks management rights on the current organization and, when it changes,
   * its destination parent. Creating or moving an organization to the root
   * requires administrator privileges.
   *
   * @param context
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      AuthRequest & {
        params: Record<string, string>;
        body?: { parentId?: unknown };
        method: string;
      }
    >();

    // The decorator runs AuthGuard before this permission guard.
    const userId = request.session!.user.id;

    // Get the organization parameter configured by the decorator, if any.
    const options = this.reflector.get<OrganizationManagementOptions>(
      ORGANIZATION_MANAGEMENT,
      context.getHandler(),
    );

    // For an existing organization, verify its current scope before considering
    // a destination supplied by the request. A missing target produces a 404.
    let currentParentId: string | null | undefined;
    if (options.organizationId) {
      const id = request.params[options.organizationId];
      const organization = await this.prisma.organization.findUniqueOrThrow({
        where: { id },
        select: { parentId: true },
      });
      currentParentId = organization.parentId;
      await this.organizationService.assertCanManageOrganizations(id, userId);
    }

    // Deletion only requires rights over the current organization.
    if (request.method === 'DELETE')
      return true;

    // On PATCH, omitting parentId preserves the current parent. On POST,
    // omitting it creates a root organization.
    const parentId = request.body?.parentId;
    if (parentId === undefined && options.organizationId) return true;

    // Guards run before DTO validation. Malformed parent identifiers are left
    // to the validation pipe instead of being used in a permissions query.
    if (
      parentId !== undefined &&
      parentId !== null &&
      (typeof parentId !== 'string' || !parentId.trim())
    )
      return true;

    // A null destination means a root. Preserve an unchanged parent without
    // requiring additional rights on the parent organization.
    const destination = parentId == null ? null : parentId.trim();
    if (options.organizationId && destination === currentParentId) return true;

    // A new parent requires management rights in that destination too.
    // The service reserves a null destination for administrators.
    await this.organizationService.assertCanManageOrganizations(
      destination,
      userId,
    );
    return true;
  }
}

/**
 * Authenticate once, then check organization management rights.
 *
 * @param options - Route parameter containing the organization ID for PATCH/DELETE.
 * Without this parameter, the guard checks the requested parent for creation.
 */
export function CanManageOrganizations(
  options: OrganizationManagementOptions = {},
) {
  return applyDecorators(
    SetMetadata(ORGANIZATION_MANAGEMENT, options),
    UseGuards(AuthGuard, CanManageOrganizationsGuard),
  );
}
