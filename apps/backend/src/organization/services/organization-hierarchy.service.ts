import { PrismaService } from '../../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type { Organization, Prisma } from '../../generated/prisma/client';

type HierarchyClient = Pick<Prisma.TransactionClient, 'organization'>;
export type OrganizationParent = {
  id: string;
  parentId: string | null;
  managerId: string | null;
};

export type HierarchyStatus = 'valid' | 'cycle' | 'missing';

/** Stateless hierarchy operations; pass the transaction client for transactional reads. */
@Injectable()
export class OrganizationHierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Walks up from the from organization through its parents at every level,
   * stopping at missing parents or cycles.
   *
   * @param fromOrganizationId - The ID of the organization to walk up from.
   * @param visited - A set of visited organization IDs to detect cycles.
   * @param client - The database client to use for the query.
   */
  private async walkOrganizationParents(
    fromOrganizationId: string | null | undefined,
    client: HierarchyClient,
    visited = new Set<string>(),
  ): Promise<{ parents: OrganizationParent[]; status: HierarchyStatus }> {
    const organizations: OrganizationParent[] = [];
    let currentId = fromOrganizationId;

    while (currentId) {
      // Found a cycle in the hierarchy, return the parents collected so far and the status as 'cycle'.
      if (visited.has(currentId))
        return { parents: organizations, status: 'cycle' };

      // Add the current organization ID to the visited set to track the organizations we've already seen.
      visited.add(currentId);

      const organization = await client.organization.findUnique({
        where: { id: currentId },
        select: { id: true, parentId: true, managerId: true },
      });

      // If the organization is not found, return the parents collected so far and the status as 'missing'.
      if (!organization) return { parents: organizations, status: 'missing' };

      // Add the current organization to the parents list and move up to its parent.
      organizations.push(organization);
      currentId = organization.parentId;
    }
    return { parents: organizations, status: 'valid' };
  }

  /**
   * Returns from organization and its parents at every level, stopping at missing parents or cycles.
   *
   * @param fromOrganizationId
   * @param client - The database client to use for the query.
   */
  async getOrganizationParents(
    fromOrganizationId: string | null,
    client: HierarchyClient = this.prisma,
  ): Promise<OrganizationParent[]> {
    const { parents } = await this.walkOrganizationParents(
      fromOrganizationId,
      client,
    );
    return parents;
  }

  /**
   * Allows to check if an organization is managed by a user, either directly or through its parents.
   *
   * @param organizationId
   * @param userId
   * @param client - The database client to use for the query.
   */
  async isManagedBy(
    organizationId: string | null,
    userId: string,
    client: HierarchyClient = this.prisma,
  ): Promise<boolean> {
    const parents = await this.getOrganizationParents(organizationId, client);
    return parents.some((organization) => organization.managerId === userId);
  }

  /**
   * Checks if the organization hierarchy is valid, if there is a cycle, or if a parent is missing.
   * Allows to check if an organization can be assigned a new parent without creating a cycle in the hierarchy.
   *
   * @param organizationId - The ID of the organization to check.
   * @param parentId - The ID of the proposed parent organization.
   * @param client - The database client to use for the query.
   */
  async validateOrganizationHierarchy(
    organizationId: string,
    parentId: string | null | undefined,
    client: HierarchyClient = this.prisma,
  ): Promise<HierarchyStatus> {
    const { status } = await this.walkOrganizationParents(
      parentId,
      client,
      new Set([organizationId]),
    );
    return status;
  }

  /**
   * Collects all children of the given organizations,
   * including the organizations themselves, and returns them as a flat list.
   *
   * @param fromOrganizations
   * @param client
   */
  async getOrganizationsWithChildren(
    fromOrganizations: Organization[],
    client: HierarchyClient = this.prisma,
  ): Promise<Organization[]> {
    const organizations = new Map<string, Organization>();
    let currentOrganizations = fromOrganizations;

    while (currentOrganizations.length > 0) {
      const parentIds: string[] = [];
      for (const organization of currentOrganizations) {
        if (organizations.has(organization.id)) continue;
        organizations.set(organization.id, organization);
        parentIds.push(organization.id);
      }

      if (parentIds.length === 0) break;
      currentOrganizations = await client.organization.findMany({
        where: { parentId: { in: parentIds } },
      });
    }

    return [...organizations.values()];
  }
}
