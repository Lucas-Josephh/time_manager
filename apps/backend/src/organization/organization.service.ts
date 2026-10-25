import { AuthService } from '../auth/auth.service';
import { paginate } from '../common/pagination/paginate';
import { fieldValidationException } from '../common/validation/validation-exception.factory';
import {
  buildOrganizationTree,
  OrganizationHierarchy,
} from './organization-hierarchy';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  OrganizationDto,
  PartialOrganizationDto,
  QueryOrganizationListDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  private readonly hierarchy: OrganizationHierarchy;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {
    this.hierarchy = new OrganizationHierarchy(prisma);
  }

  /**
   * Assert that the user has permission to manage the specified organization.
   * 1. If the user is an administrator, they can manage all organizations.
   * 2. If the user is a manager, they can manage organizations they directly manage or any of their children.
   *
   * @param organizationId
   * @param userId
   */
  async assertCanManageOrganizations(
    organizationId: string | null,
    userId: string,
  ): Promise<void> {
    if (await this.authService.isAdmin(userId)) return;
    if (await this.hierarchy.isManagedBy(organizationId, userId)) return;

    throw new ForbiddenException();
  }

  /**
   * Create a new organization with the provided data transfer object (DTO).
   *
   * @param dto
   */
  create(dto: OrganizationDto) {
    return this.prisma.organization.create({ data: dto });
  }

  /**
   * Return a paginated list of organizations based on the provided filters.
   * The results are ordered by name and id in ascending order.
   *
   * @param filters
   */
  findAll(filters: QueryOrganizationListDto = {}) {
    const where: Prisma.OrganizationWhereInput = {};
    if (filters.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }
    if (filters.parentId) where.parentId = filters.parentId;
    if (filters.managerId) where.managerId = filters.managerId;

    return paginate(filters, (range) =>
      this.prisma.$transaction(
        [
          this.prisma.organization.findMany({
            where,
            ...range,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
          }),
          this.prisma.organization.count({ where }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }

  /**
   * Return the organization tree starting from the specified root
   * organization (if provided) or from all root organizations.
   *
   * @param userId
   * @param targetRootId
   */
  tree(userId: string, targetRootId?: string) {
    // All reads share the same snapshot of the organization hierarchy.
    return this.prisma.$transaction(
      async (tx) => {
        const organizations = await this.loadAccessibleOrganizations(
          tx,
          userId,
          targetRootId,
        );
        return buildOrganizationTree(organizations, targetRootId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async loadAccessibleOrganizations(
    tx: Prisma.TransactionClient,
    userId: string,
    targetRootId?: string,
  ) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    const isAdmin = user?.isAdmin ?? false;

    // Load all of a manager's branches. Look up the requested root
    // within those branches when building the tree.
    let where: Prisma.OrganizationWhereInput = { managerId: userId };
    if (isAdmin) {
      where = targetRootId ? { id: targetRootId } : { parentId: null };
    }
    const roots = await tx.organization.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    if (!isAdmin && roots.length === 0) throw new ForbiddenException();

    const hierarchy = new OrganizationHierarchy(tx);
    return hierarchy.getOrganizationChildren(roots);
  }

  /**
   * Return a single organization by its unique identifier.
   *
   * @param id
   */
  findOne(id: string) {
    return this.prisma.organization.findUniqueOrThrow({ where: { id } });
  }

  /**
   * Update an existing organization with the provided data transfer object (DTO).
   *
   * @param id
   * @param dto
   */
  update(id: string, dto: PartialOrganizationDto) {
    // Serializable isolation prevents concurrent re-parenting from creating a cycle.
    return this.prisma.$transaction(
      async (tx) => {
        await tx.organization.findUniqueOrThrow({
          where: { id },
          select: { id: true },
        });
        const hierarchy = new OrganizationHierarchy(tx);
        const result = await hierarchy.validateOrganizationHierarchy(
          id,
          dto.parentId,
        );
        if (result === 'cycle')
          throw fieldValidationException('parentId', 'organization_cycle');
        if (result === 'missing')
          throw fieldValidationException('parentId', 'reference_not_found');
        return tx.organization.update({ where: { id }, data: dto });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Delete an organization by its unique identifier.
   *
   * @param id
   */
  delete(id: string) {
    return this.prisma.organization.delete({ where: { id } });
  }
}
