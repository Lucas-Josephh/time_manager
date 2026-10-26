import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Organization, Prisma } from '../../generated/prisma/client';
import { OrganizationHierarchyService } from './organization-hierarchy.service';

@Injectable()
export class OrganizationAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly hierarchy: OrganizationHierarchyService,
  ) {}

  /**
   * Assert that the actor can manage the given organization, either by being an admin or by managing it directly or indirectly.
   *
   * @param organizationId
   * @param actor
   * @param tx
   * @private
   */
  private async assertCanManage(
    organizationId: string | null,
    actor: string,
    tx: Prisma.TransactionClient,
  ) {
    if (await this.auth.isAdmin(actor, tx)) return;
    if (await this.hierarchy.isManagedBy(organizationId, actor, tx)) return;
    throw new ForbiddenException();
  }

  /**
   * Assert that the actor can create an organization under the given parent.
   *
   * @param parentId
   * @param actor
   * @param tx
   */
  async assertCanCreate(
    parentId: string | null,
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    await this.assertCanManage(parentId, actor, tx);
  }

  /**
   * Assert that the actor can update the given organization, including changing its parent.
   *
   * @param organization
   * @param parentId
   * @param actor
   * @param tx
   */
  async assertCanUpdate(
    organization: Pick<Organization, 'id' | 'parentId'>,
    parentId: string | null | undefined,
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    await this.assertCanManage(organization.id, actor, tx);
    if (parentId !== undefined && parentId !== organization.parentId) {
      await this.assertCanManage(parentId, actor, tx);
    }
  }

  /**
   * Assert that the actor can delete the given organization.
   *
   * @param organization
   * @param actor
   * @param tx
   */
  async assertCanDelete(
    organization: Pick<Organization, 'id'>,
    actor: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    await this.assertCanManage(organization.id, actor, tx);
  }

  /**
   * Return the where input for the root of the organization tree that the actor
   * can access, either by being an admin or by managing it directly or indirectly.
   *
   * If the actor is an admin, they can access any organization, including the root of the tree.
   * If the actor is not an admin, they can only access organizations they manage directly or indirectly.
   *
   * @param actor
   * @param targetRootId
   * @param tx
   */
  async getTreeRootScope(
    actor: string,
    targetRootId: string | undefined,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Prisma.OrganizationWhereInput> {
    // Admins can access any organization, including the root of the tree.
    if (await this.auth.isAdmin(actor, tx))
      return targetRootId ? { id: targetRootId } : { parentId: null };

    // Non-admins can only access organizations they manage directly or indirectly.
    const managed = await tx.organization.findMany({
      where: { managerId: actor },
      select: { id: true },
    });

    // If a target root is specified, check if the actor manages it directly or indirectly.
    if (!managed.length)
      throw new ForbiddenException();

    // If a target root is specified, check if the actor manages it directly or indirectly.
    return { managerId: actor };
  }
}
