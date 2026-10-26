import { NotFoundException } from '@nestjs/common';
import type { Organization } from '../../generated/prisma/client';
import type { OrganizationTreeDto } from '../dto/organization.dto';

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
  // Transform the flat list of organizations into a map of nodes for easy access.
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
function createNodes(
  organizations: Organization[],
): Map<string, OrganizationTreeDto> {
  const nodes: Map<string, OrganizationTreeDto> = new Map();
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
function connectChildren(
  nodes: Map<string, OrganizationTreeDto>,
): OrganizationTreeDto[] {
  const roots: OrganizationTreeDto[] = [];
  const sortedNodes = [...nodes.values()].sort((first, second) =>
    compareNodes(first, second),
  );

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
