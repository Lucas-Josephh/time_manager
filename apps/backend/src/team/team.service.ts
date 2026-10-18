import { Injectable } from '@nestjs/common';
import { requireResource } from '../common/require-resource';
import { PrismaService } from '../prisma/prisma.service';
import { PartialTeamDto, QueryTeamDto, TeamDto } from './dto/team.dto';
import { Prisma } from '../generated/prisma/client';

export function buildTeamQueryFilter(
  filters: QueryTeamDto,
): Prisma.TeamWhereInput {
  const where: Prisma.TeamWhereInput = {};

  if (filters.name) {
    where.name = { contains: filters.name, mode: 'insensitive' };
  }

  if (filters.organizationId) {
    where.organizationId = filters.organizationId;
  }

  if (filters.managerId) {
    where.managerId = filters.managerId;
  }

  if (filters.memberId !== undefined) {
    where.members = {
      some: { id: filters.memberId },
    };
  }

  return where;
}

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: TeamDto) {
    return this.prisma.team.create({
      data: {
        name: dto.name,
        managerId: dto.managerId,
        organizationId: dto.organizationId,
      },
    });
  }

  findOne(id: string) {
    return requireResource(
      this.prisma.team.findUnique({
        where: { id },
        include: {
          manager: true,
          organization: true,
          members: true,
        },
      }),
    );
  }

  findAll(filters: QueryTeamDto = {}) {
    return this.prisma.team.findMany({
      where: buildTeamQueryFilter(filters),
      orderBy: { name: 'asc' },
      include: {
        manager: true,
        organization: true,
        members: true,
      },
    });
  }

  replace(id: string, dto: TeamDto) {
    return this.prisma.team.update({
      where: { id },
      data: dto,
    });
  }

  update(id: string, dto: PartialTeamDto) {
    return this.prisma.team.update({
      where: { id },
      data: dto,
    });
  }

  delete(id: string) {
    return this.prisma.team.delete({ where: { id } });
  }
}
