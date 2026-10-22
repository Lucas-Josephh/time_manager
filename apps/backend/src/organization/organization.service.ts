import { fieldValidationException } from '../common/validation/validation-exception.factory';
import { checkOrganizationParent } from './organization-hierarchy';
import { requireResource } from '../common/require-resource';
import {
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

        // Define the order in which organizations should be retrieved: first by name, then by id.
        const orderBy = [{ name: 'asc' as const }, { id: 'asc' as const }];

        // Define the where clause for admins, filtering by the target root id if provided, or selecting root organizations (parentId: null) if not.
        const whereAdmin = targetRootId
          ? { id: targetRootId } // If a targetRootId is provided, select that specific organization for admins.
          : { parentId: null }; // If no targetRootId is provided, select root organizations (parentId: null) for admins.

        // Define the where clause for managers, filtering by the target root id if provided, and ensuring that the managerId matches the userId.
        const whereManager = targetRootId
          ? { id: targetRootId, managerId: userId } // If a targetRootId is provided, select that specific organization for managers, ensuring they are the manager of that organization.
          : { parentId: null, managerId: userId }; // If no targetRootId is provided, select root organizations (parentId: null) for managers, ensuring they are the manager of those organizations.

        // Fetch the root organizations based on the user's role and the provided rootId filter.
        const seeds = await tx.organization.findMany({
          where: user?.isAdmin ? whereAdmin : whereManager,
          orderBy,
        });

        // If the user is not an admin and there are no organizations they manage, throw a ForbiddenException.
        if (!user?.isAdmin && !seeds.length) throw new ForbiddenException();

        // Build the organization tree.
        const nodes = new Map<string, OrganizationTreeDto>();
        let level = seeds;
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

          level = await tx.organization.findMany({
            where: { parentId: { in: ids } },
            orderBy,
          });
        }
        if (targetRootId && !nodes.has(targetRootId))
          throw new NotFoundException('not_found');

        // Build the organization tree.
        const roots: OrganizationTreeDto[] = [];
        const sorted = [...nodes.values()].sort(
          (a, b) =>
            (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        );
        for (const node of sorted) {
          const parent = node.parentId ? nodes.get(node.parentId) : undefined;
          if (parent) parent.children.push(node);
          else roots.push(node);
        }
        const result = targetRootId ? [nodes.get(targetRootId)!] : roots;
        if (!name && !managerId) return result;

        const search = name?.toLowerCase();
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
        await requireResource(
          tx.organization.findUnique({
            where: { id },
            select: { id: true },
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
        return tx.organization.update({ where: { id }, data: dto });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  delete(id: string) {
    return this.prisma.organization.delete({ where: { id } });
  }
}
