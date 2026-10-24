import { fieldValidationException } from '../common/validation/validation-exception.factory';
import {
  checkOrganizationParent,
  getOrganizationAncestors,
  getOrganizationDescendantIds,
} from './organization-hierarchy';
import { requireResource } from '../common/require-resource';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  OrganizationDto,
  OrganizationTreeDto,
  PartialOrganizationDto,
  QueryOrganizationDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanManageOrganizations(
    organizationId: string | null,
    userId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (!user) throw new ForbiddenException();
    if (user.isAdmin) return;
    const ancestors = await getOrganizationAncestors(organizationId, (id) =>
      this.prisma.organization.findUnique({
        where: { id },
        select: { managerId: true, parentId: true },
      }),
    );
    if (ancestors.some((organization) => organization.managerId === userId))
      return;
    throw new ForbiddenException();
  }

  create(dto: OrganizationDto) {
    return this.prisma.organization.create({ data: dto });
  }

  findAll(filters: QueryOrganizationDto = {}) {
    return this.prisma.organization.findMany({
      where: {
        ...(filters.name
          ? { name: { contains: filters.name, mode: 'insensitive' as const } }
          : {}),
        ...(filters.parentId ? { parentId: filters.parentId } : {}),
        ...(filters.managerId ? { managerId: filters.managerId } : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Return the organization tree starting from the specified root
   * organization (if provided) or from all root organizations.
   *
   * @param userId
   * @param filters
   */
  tree(userId: string, filters: QueryOrganizationDto = {}) {
    const { parentId: targetRootId, name, managerId } = filters;

    // Starting a prisma transaction with RepeatableRead isolation level to ensure consistent reads of the organization hierarchy.
    return this.prisma.$transaction(
      async (tx) => {
        // Fetch the user to check if they are an admin.
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { isAdmin: true },
        });

        const isAdmin = user?.isAdmin ?? false;
        const orderBy: Prisma.OrganizationOrderByWithRelationInput[] = [
          { name: 'asc' },
          { id: 'asc' },
        ];

        let where: Prisma.OrganizationWhereInput;
        if (!isAdmin) {
          // Start from all managed organizations; the requested subtree is
          // authorized against their descendants after traversal.
          where = { managerId: userId };
        } else if (targetRootId) {
          // Start from the specified root organization if provided.
          where = { id: targetRootId };
        } else {
          // From all root organizations if no target root is specified.
          where = { parentId: null };
        }

        // Fetch the starting organizations based on the constructed where clause.
        const startingOrganizations = await tx.organization.findMany({
          where,
          orderBy,
        });

        // If the user is not an admin and there are no starting organizations, throw a ForbiddenException.
        if (!isAdmin && !startingOrganizations.length)
          throw new ForbiddenException();

        // Build the organization tree.
        const nodes = new Map<string, OrganizationTreeDto>();
        let level = startingOrganizations;
        while (level.length) {
          const ids: string[] = [];
          for (const organization of level) {
            // Check if the organization has already been added to the nodes map to avoid duplicates.
            if (nodes.has(organization.id)) continue;

            // Add the organization to the nodes map with an empty children array.
            nodes.set(organization.id, {
              ...organization,
              children: [],
            });

            // Collect the ids of the current level organizations to fetch their children in the next iteration.
            ids.push(organization.id);
          }

          // If there are no more ids to process, break the loop.
          if (!ids.length) break;

          // Fetch the next level of organizations whose parentId is in the collected ids.
          level = await tx.organization.findMany({
            where: { parentId: { in: ids } },
            orderBy,
          });
        }

        // If a targetRootId is provided, ensure it exists in the nodes map; if not, throw a NotFoundException.
        if (targetRootId && !nodes.has(targetRootId))
          throw new NotFoundException();

        // Build the organization tree.
        const roots: OrganizationTreeDto[] = [];

        // Sort the nodes by name and id to ensure a consistent order in the tree.
        const sorted = [...nodes.values()].sort(
          (a, b) =>
            (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        );

        // Build the tree structure by assigning children to their respective parents.
        for (const node of sorted) {
          const parent = node.parentId ? nodes.get(node.parentId) : undefined;
          if (parent) parent.children.push(node);
          else roots.push(node);
        }

        // If a targetRootId is provided, return only that node; otherwise, return all root nodes.
        const result = targetRootId ? [nodes.get(targetRootId)!] : roots;
        if (!name && !managerId) return result;

        // Filter the tree based on the provided name and managerId filters.
        const search = name?.toLowerCase();

        // Recursively filter the organization tree to include only nodes that match the search criteria or have matching descendants.
        const filterBranches = (
          branches: OrganizationTreeDto[],
        ): OrganizationTreeDto[] =>
          branches.flatMap((node) => {
            const children = filterBranches(node.children);
            const matches =
              (!search || node.name.toLowerCase().includes(search)) &&
              (!managerId || node.managerId === managerId);
            return matches || children.length > 0
              ? [{ ...node, children }]
              : [];
          });
        return filterBranches(result);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  findOne(id: string) {
    return requireResource(
      this.prisma.organization.findUnique({ where: { id } }),
    );
  }

  update(id: string, dto: PartialOrganizationDto) {
    // Serializable isolation prevents concurrent re-parenting from creating a cycle.
    return this.prisma.$transaction(
      async (tx) => {
        const organization = await requireResource(
          tx.organization.findUnique({
            where: { id },
            select: { parentId: true },
          }),
        );
        const result = await checkOrganizationParent(
          id,
          dto.parentId,
          (parentId) =>
            tx.organization.findUnique({
              where: { id: parentId },
              select: { parentId: true },
            }),
        );
        if (result === 'cycle')
          throw fieldValidationException('parentId', 'organization_cycle');
        if (result === 'missing')
          throw fieldValidationException('parentId', 'reference_not_found');
        if (
          dto.parentId !== undefined &&
          dto.parentId !== organization.parentId
        ) {
          await this.assertTeamMembershipsPreserved(
            tx,
            id,
            organization.parentId,
            dto.parentId,
          );
        }
        return tx.organization.update({ where: { id }, data: dto });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Only teams belonging to former ancestors can lose access to the moved users. */
  private async assertTeamMembershipsPreserved(
    tx: Prisma.TransactionClient,
    organizationId: string,
    currentParentId: string | null,
    newParentId: string | null,
  ): Promise<void> {
    const findParent = (id: string) =>
      tx.organization.findUnique({
        where: { id },
        select: { parentId: true },
      });
    const previousAncestors = await getOrganizationAncestors(
      currentParentId,
      findParent,
    );
    const nextAncestors = await getOrganizationAncestors(
      newParentId,
      findParent,
    );
    const nextAncestorIds = new Set(
      nextAncestors.map((organization) => organization.id),
    );
    const removedAncestorIds = previousAncestors
      .filter((organization) => !nextAncestorIds.has(organization.id))
      .map((organization) => organization.id);
    if (removedAncestorIds.length === 0) return;

    const movedOrganizationIds = await getOrganizationDescendantIds(
      organizationId,
      (parentIds) =>
        tx.organization.findMany({
          where: { parentId: { in: parentIds } },
          select: { id: true },
        }),
    );
    const affectedMembers = await tx.user.findMany({
      where: {
        organizationId: { in: movedOrganizationIds },
        team: { is: { organizationId: { in: removedAncestorIds } } },
      },
      select: { id: true, firstname: true, lastname: true, teamId: true },
      orderBy: { id: 'asc' },
    });
    if (affectedMembers.length > 0) {
      throw new ConflictException({
        message: 'organization_move_invalidates_team_memberships',
        data: { affectedMembers },
      });
    }
  }

  delete(id: string) {
    return this.prisma.organization.delete({ where: { id } });
  }
}
