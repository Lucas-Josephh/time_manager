import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import TeamDto from './dto/team.dto';
import { DepartmentsService } from '../departments/departments.service';

@Injectable()
export class TeamsService {
  constructor(
    private readonly departments: DepartmentsService,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: TeamDto) {
    const department = await this.departments.findOne(dto.departmentId);

    if (!department) {
      throw new NotFoundException('department_not_found');
    }
  }
}
