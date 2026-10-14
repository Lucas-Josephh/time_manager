import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartialTeamDto, TeamDto } from './dto/team.dto';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: TeamDto) {
    return this.prisma.team.create({
      data: {
        name: dto.name,
        managerId: dto.managerId,
        departmentId: dto.departmentId,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        manager: true,
        department: true,
        members: true,
      },
    });
  }

  findAll() {
    return this.prisma.team.findMany({
      orderBy: { name: 'asc' },
      include: {
        manager: true,
        department: true,
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
