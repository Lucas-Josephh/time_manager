/**
 * Checks if the organization hierarchy is valid, if there is a cycle, or if a parent is missing.
 * Allows to check if an organization can be assigned a new parent without creating a cycle in the hierarchy.
 *
 * @param organizationId
 * @param parentId
 * @param findParent
 */
export async function checkOrganizationParent(
  organizationId: string,
  parentId: string | null | undefined,
  findParent: (id: string) => Promise<{ parentId: string | null } | null>,
): Promise<'valid' | 'cycle' | 'missing'> {
  const visited = new Set<string>([organizationId]);
  while (parentId) {
    if (visited.has(parentId)) return 'cycle';
    visited.add(parentId);
    const parent = await findParent(parentId);
    if (!parent) return 'missing';
    parentId = parent.parentId;
  }
  return 'valid';
}

/** Return the organization and its ancestors, stopping at a missing parent or a cycle. */
export async function getOrganizationAncestors<
  T extends { parentId: string | null },
>(
  organizationId: string | null,
  findParent: (id: string) => PromiseLike<T | null>,
): Promise<Array<T & { id: string }>> {
  const ancestors: Array<T & { id: string }> = [];
  const visited = new Set<string>();
  let currentId = organizationId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const organization = await findParent(currentId);
    if (!organization) break;
    ancestors.push({ ...organization, id: currentId });
    currentId = organization.parentId;
  }
  return ancestors;
}

/** Return the root ID and all descendant IDs, without duplicates. */
export async function getOrganizationDescendantIds(
  organizationId: string,
  findChildren: (parentIds: string[]) => PromiseLike<Array<{ id: string }>>,
): Promise<string[]> {
  const organizationIds = new Set([organizationId]);
  let currentParentIds = [organizationId];

  while (currentParentIds.length > 0) {
    const children = await findChildren(currentParentIds);
    currentParentIds = [];
    for (const child of children) {
      if (organizationIds.has(child.id)) continue;
      organizationIds.add(child.id);
      currentParentIds.push(child.id);
    }
  }
  return [...organizationIds];
}
