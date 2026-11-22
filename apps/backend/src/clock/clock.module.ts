import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { ClockController } from './controllers/clock.controller';
import { ClockService } from './services/clock.service';

@Module({
  imports: [AuthModule, PrismaModule, ScheduleModule],
  controllers: [ClockController],
  providers: [ClockService],
})
export class ClockModule {}
