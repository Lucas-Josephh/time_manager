/** Shared by DTO validation and the transactional write guard. */
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
