import { checkOrganizationParent } from './organization-hierarchy';
import { requireResource } from '../common/require-resource';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  OrganizationDto,
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
          throw new ConflictException('organization_cycle');
        if (result === 'missing')
          throw new NotFoundException('not_found');
        return tx.organization.update({ where: { id }, data: dto });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  delete(id: string) {
    return this.prisma.organization.delete({ where: { id } });
  }
}
