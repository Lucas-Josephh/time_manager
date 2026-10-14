import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { PrismaModule } from '../prisma/prisma.module';
import { parseArgs } from 'util';
import { NestFactory } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(__dirname, '../../.env'), resolve(__dirname, '../../../../.env')],
    }),
    PrismaModule,
  ],
})
export class CreateUserCommand {}


async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      firstname: { type: 'string' },
      lastname: { type: 'string' },
      'team-id': { type: 'string' },
    },
  });

  const email = values.email?.trim().toLowerCase();
  const firstname = values.firstname?.trim();
  const lastname = values.lastname?.trim();
  const teamId = values['team-id']?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('--email doit être une adresse valide');
  }

  if (!firstname || !lastname) {
    throw new Error('--firstname et --lastname sont requis');
  }

  if (!teamId) {
    throw new Error('--team-id est requis');
  }

  const app = await NestFactory.createApplicationContext(CreateUserCommand, {
    abortOnError: false,
  });

  try {
    const prisma = app.get(PrismaService);

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new Error('Un utilisateur possède déjà cet email');
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new Error('L’équipe indiquée par --team-id est introuvable');
    }

    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email,
        firstname,
        lastname,
        teamId,
      },
    });

    console.log(`Utilisateur créé : ${user.email}`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
