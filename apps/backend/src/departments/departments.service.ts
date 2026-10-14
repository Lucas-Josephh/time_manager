import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {

  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    return this.prisma.department.findUnique({
      where: { id },
    });
  }
}
