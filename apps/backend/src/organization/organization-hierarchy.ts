import type { Prisma } from '../generated/prisma/client';

type HierarchyClient = Pick<Prisma.TransactionClient, 'organization'>;
type OrganizationAncestor = {
  id: string;
  parentId: string | null;
  managerId: string | null;
};

/**
 * Checks if the organization hierarchy is valid, if there is a cycle, or if a parent is missing.
 *
 * Allows to check if an organization can be assigned a new parent without creating a cycle in the hierarchy.
 *
 * @param organizationId - The ID of the organization to check.
 * @param parentId - The ID of the proposed parent organization.
 * @param prisma - Prisma client or active transaction client.
 */
export async function checkOrganizationParent(
  organizationId: string,
  parentId: string | null | undefined,
  prisma: HierarchyClient,
): Promise<'valid' | 'cycle' | 'missing'> {
  const visited = new Set<string>([organizationId]);
  while (parentId) {
    if (visited.has(parentId)) return 'cycle';
    visited.add(parentId);
    const parent = await prisma.organization.findUnique({
      where: { id: parentId },
      select: { parentId: true },
    });
    if (!parent) return 'missing';
    parentId = parent.parentId;
  }
  return 'valid';
}

/**
 * Returns the organization and all its ancestors, stopping at missing parents or cycles.
 *
 * @param organizationId
 * @param prisma - Prisma client or active transaction client.
 */
export async function getOrganizationAncestors(
  organizationId: string | null,
  prisma: HierarchyClient,
): Promise<OrganizationAncestor[]> {
  const ancestors: OrganizationAncestor[] = [];
  const visited = new Set<string>();
  let currentId = organizationId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const organization = await prisma.organization.findUnique({
      where: { id: currentId },
      select: { id: true, parentId: true, managerId: true },
    });

    // If the organization is not found, we stop the search. This could happen if the organization has been deleted or if there is a missing parent in the hierarchy.
    if (!organization) break;
    ancestors.push(organization);

    // Move up to the parent organization for the next iteration. (if null, the loop will exit)
    currentId = organization.parentId;
  }
  return ancestors;
}

/**
 * Returns the organization and all its descendants, including itself, stopping at missing children or cycles.
 *
 * @param organizationId - The ID of the organization to start from.
 * @param prisma - Prisma client or active transaction client.
 */
export async function getOrganizationDescendantIds(
  organizationId: string,
  prisma: HierarchyClient,
): Promise<string[]> {
  const organizationIds = new Set([organizationId]);
  let currentParentIds = [organizationId];

  while (currentParentIds.length > 0) {
    // Get all children of the current parent organizations.
    const children = await prisma.organization.findMany({
      where: { parentId: { in: currentParentIds } },
      select: { id: true },
    });
    currentParentIds = [];
    for (const child of children) {
      if (organizationIds.has(child.id)) continue;
      organizationIds.add(child.id);
      currentParentIds.push(child.id);
    }
  }
  return [...organizationIds];
}
