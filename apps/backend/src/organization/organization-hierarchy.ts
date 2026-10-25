import { NotFoundException } from '@nestjs/common';
import type { OrganizationTreeDto } from './dto/organization.dto';
import type { Organization, Prisma } from '../generated/prisma/client';

type HierarchyClient = Pick<Prisma.TransactionClient, 'organization'>;
export type OrganizationParent = {
  id: string;
  parentId: string | null;
  managerId: string | null;
};

export type HierarchyStatus = 'valid' | 'cycle' | 'missing';

/** Uses one database client for all hierarchy operations.
 * Inside a transaction, create an instance with that transaction's client.
 */
export class OrganizationHierarchy {
  constructor(private readonly prisma: HierarchyClient) {}

  /**
   * Walks up from the from organization through its parents at every level,
   * stopping at missing parents or cycles.
   *
   * @param fromOrganizationId - The ID of the organization to walk up from.
   * @param visited - A set of visited organization IDs to detect cycles.
   */
  private async walkOrganizationParents(
    fromOrganizationId: string | null | undefined,
    visited = new Set<string>(),
  ): Promise<{ parents: OrganizationParent[]; status: HierarchyStatus }> {
    const parents: OrganizationParent[] = [];
    let currentId = fromOrganizationId;

    while (currentId) {
      if (visited.has(currentId)) return { parents, status: 'cycle' };
      visited.add(currentId);
      const organization = await this.prisma.organization.findUnique({
        where: { id: currentId },
        select: { id: true, parentId: true, managerId: true },
      });
      if (!organization) return { parents, status: 'missing' };
      parents.push(organization);
      currentId = organization.parentId;
    }
    return { parents, status: 'valid' };
  }

  /**
   * Returns from organization and its parents at every level, stopping at missing parents or cycles.
   *
   * @param fromOrganizationId
   */
  async getOrganizationParents(
    fromOrganizationId: string | null,
  ): Promise<OrganizationParent[]> {
    const { parents } = await this.walkOrganizationParents(fromOrganizationId);
    return parents;
  }

  /**
   * Allows to check if an organization is managed by a user, either directly or through its parents.
   *
   * @param organizationId
   * @param userId
   */
  async isManagedBy(
    organizationId: string | null,
    userId: string,
  ): Promise<boolean> {
    const parents = await this.getOrganizationParents(organizationId);
    return parents.some((organization) => organization.managerId === userId);
  }

  /**
   * Checks if the organization hierarchy is valid, if there is a cycle, or if a parent is missing.
   * Allows to check if an organization can be assigned a new parent without creating a cycle in the hierarchy.
   *
   * @param organizationId - The ID of the organization to check.
   * @param parentId - The ID of the proposed parent organization.
   */
  async validateOrganizationHierarchy(
    organizationId: string,
    parentId: string | null | undefined,
  ): Promise<HierarchyStatus> {
    const { status } = await this.walkOrganizationParents(
      parentId,
      new Set([organizationId]),
    );
    return status;
  }

  /** Collect from organizations and children at every level, without duplicates. */
  private async collectOrganizationChildren<T extends { id: string }>(
    fromOrganizations: T[],
    findChildren: (parentIds: string[]) => Promise<T[]>,
  ): Promise<T[]> {
    const organizations = new Map<string, T>();
    let currentOrganizations = fromOrganizations;

    while (currentOrganizations.length > 0) {
      const parentIds: string[] = [];
      for (const organization of currentOrganizations) {
        if (organizations.has(organization.id)) continue;
        organizations.set(organization.id, organization);
        parentIds.push(organization.id);
      }

      if (parentIds.length === 0) break;
      currentOrganizations = await findChildren(parentIds);
    }
    return [...organizations.values()];
  }

  /**
   * Returns from organization ID and its children IDs at every level, without duplicates.
   *
   * @param fromOrganizationId - The ID of from organization.
   */
  async getOrganizationChildrenIds(
    fromOrganizationId: string,
  ): Promise<string[]> {
    const organizations = await this.collectOrganizationChildren(
      [{ id: fromOrganizationId }],
      (parentIds) =>
        this.prisma.organization.findMany({
          where: { parentId: { in: parentIds } },
          select: { id: true },
        }),
    );
    return organizations.map(({ id }) => id);
  }

  /** Returns from organizations and their children at every level, without duplicates. */
  async getOrganizationChildren(
    fromOrganizations: Organization[],
  ): Promise<Organization[]> {
    return this.collectOrganizationChildren(fromOrganizations, (parentIds) =>
      this.prisma.organization.findMany({
        where: { parentId: { in: parentIds } },
      }),
    );
  }
}

type OrganizationNodes = Map<string, OrganizationTreeDto>;

/**
 * Build a tree structure of organizations from a flat list of organizations.
 *
 * @param organizations
 * @param targetRootId
 */
export function buildOrganizationTree(
  organizations: Organization[],
  targetRootId?: string,
): OrganizationTreeDto[] {
  const nodes = createNodes(organizations);
  const targetRoot = targetRootId ? nodes.get(targetRootId) : undefined;
  if (targetRootId && !targetRoot) throw new NotFoundException();

  const roots = connectChildren(nodes);
  if (targetRoot) return [targetRoot];
  return roots;
}

/**
 * Create a map of organization nodes from the flat list of organizations.
 *
 * @param organizations
 */
function createNodes(organizations: Organization[]): OrganizationNodes {
  const nodes: OrganizationNodes = new Map();
  for (const organization of organizations) {
    nodes.set(organization.id, { ...organization, children: [] });
  }
  return nodes;
}

/**
 * Connect child nodes to their respective parent nodes and return the root nodes.
 *
 * @param nodes
 */
function connectChildren(nodes: OrganizationNodes): OrganizationTreeDto[] {
  const roots: OrganizationTreeDto[] = [];
  const sortedNodes = [...nodes.values()].sort(compareNodes);

  for (const node of sortedNodes) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Compare two organization nodes for sorting purposes.
 *
 * @param first
 * @param second
 */
function compareNodes(
  first: OrganizationTreeDto,
  second: OrganizationTreeDto,
): number {
  if (first.name < second.name) return -1;
  if (first.name > second.name) return 1;
  if (first.id < second.id) return -1;
  if (first.id > second.id) return 1;
  return 0;
}
