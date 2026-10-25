import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { resolve } from 'node:path';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: [resolve(__dirname, '../../.env'), resolve(__dirname, '../../../../.env')] }), PrismaModule] })
class CleanupModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(CleanupModule, { logger: ['error'] });
  try {
    const prisma = app.get(PrismaService);
    await prisma.$transaction(async tx => {
      const teams = await tx.team.findMany({ where: { managerId: { not: null } }, select: { id: true, managerId: true } });
      const conflicts = [] as { userId: string; teamId: string }[];
      for (const team of teams) {
        const user = await tx.user.findUnique({ where: { id: team.managerId! }, select: { teamId: true } });
        if (user?.teamId === team.id) conflicts.push({ userId: team.managerId!, teamId: team.id });
      }
      console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview', conflicts }, null, 2));
      if (process.argv.includes('--apply')) {
        for (const conflict of conflicts) await tx.user.updateMany({ where: { id: conflict.userId, teamId: conflict.teamId }, data: { teamId: null } });
        console.log(`Removed ${conflicts.length} memberships; manager roles preserved.`);
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } finally { await app.close(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
