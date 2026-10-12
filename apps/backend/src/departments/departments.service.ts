import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: DepartmentDto) {
    return this.prisma.department.create({
      data: { id: randomUUID(), ...dto },
    });
  }

  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const result = await this.prisma.department.findUnique({ where: { id } });
    if (!result) throw new NotFoundException('department_not_found');
    return result;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);

    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.department.delete({ where: { id } });
  }
}
