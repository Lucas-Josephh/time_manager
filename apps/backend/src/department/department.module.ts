import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DepartmentService } from './department.service';

@Module({
  imports: [PrismaModule],
  providers: [DepartmentService],
})
export class DepartmentModule {}
