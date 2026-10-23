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
