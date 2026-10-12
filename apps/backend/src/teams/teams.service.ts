import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import TeamDto, { UpdateTeamDto } from './dto/team.dto';
import { DepartmentsService } from '../departments/departments.service';

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departments: DepartmentsService,
  ) {}

  async create(dto: TeamDto) {
    await this.validateReferences(dto);
    return this.prisma.team.create({ data: { id: randomUUID(), ...dto } });
  }

  findAll() {
    return this.prisma.team.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const result = await this.prisma.team.findUnique({ where: { id } });
    if (!result) throw new NotFoundException('team_not_found');
    return result;
  }

  async update(id: string, dto: UpdateTeamDto) {
    await this.findOne(id);
    await this.validateReferences(dto);
    return this.prisma.team.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.team.delete({ where: { id } });
  }
  private async validateReferences(dto: UpdateTeamDto) {
    if (dto.departmentId !== undefined)
      await this.departments.findOne(dto.departmentId);
    if (dto.managerId !== undefined && dto.managerId !== null) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.managerId },
      });
      if (!manager) throw new NotFoundException('manager_not_found');
    }
  }
}
