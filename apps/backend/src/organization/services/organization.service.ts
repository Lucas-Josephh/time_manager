import { buildOrganizationTree } from '../utils/build-organization-tree';
import { OrganizationAuthorizationService } from './organization-authorization.service';
import { paginate } from '../../common/pagination/paginate';
import { ValidationException } from '../../common/validation/validation.exception';
import { OrganizationHierarchyService } from './organization-hierarchy.service';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import {
  OrganizationDto,
  PartialOrganizationDto,
  QueryOrganizationListDto,
} from '../dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: OrganizationAuthorizationService,
    private readonly hierarchy: OrganizationHierarchyService,
  ) {}

  /**
   * Create a new organization with the provided data transfer object (DTO).
   *
   * @param dto
   * @param actor
   */
  create(dto: OrganizationDto, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.authorization.assertCanCreate(
          dto.parentId ?? null,
          actor,
          tx,
        );
        return tx.organization.create({ data: dto });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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

  /**
   * Load the organizations accessible to the specified user, optionally starting from a specific root organization.
   *
   * @param tx
   * @param userId
   * @param targetRootId
   * @private
   */
  private async loadAccessibleOrganizations(
    tx: Prisma.TransactionClient,
    userId: string,
    targetRootId?: string,
  ) {
    if (targetRootId)
      await tx.organization.findUniqueOrThrow({
        where: { id: targetRootId },
        select: { id: true },
      });

    const where = await this.authorization.getTreeRootScope(
      userId,
      targetRootId,
      tx,
    );

    const roots = await tx.organization.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    return this.hierarchy.getOrganizationsWithChildren(roots, tx);
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
   * @param actor
   */
  update(id: string, dto: PartialOrganizationDto, actor: string) {
    // Serializable isolation prevents concurrent re-parenting from creating a cycle.
    return this.prisma.$transaction(
      async (tx) => {
        const organization = await tx.organization.findUniqueOrThrow({
          where: { id },
          select: { id: true, parentId: true },
        });

        await this.authorization.assertCanUpdate(
          organization,
          dto.parentId,
          actor,
          tx,
        );

        const result = await this.hierarchy.validateOrganizationHierarchy(
          id,
          dto.parentId,
          tx,
        );

        if (result === 'cycle')
          throw ValidationException.forField('parentId', 'organization_cycle');

        if (result === 'missing')
          throw ValidationException.forField('parentId', 'reference_not_found');

        return tx.organization.update({ where: { id }, data: dto });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Delete an organization by its unique identifier.
   *
   * @param id
   * @param actor
   */
  delete(id: string, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const organization = await tx.organization.findUniqueOrThrow({
          where: { id },
          select: { id: true },
        });
        await this.authorization.assertCanDelete(organization, actor, tx);
        return tx.organization.delete({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
