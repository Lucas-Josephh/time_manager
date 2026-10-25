import { buildUserName } from '../user/utils/build-user-name';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { PrismaModule } from '../prisma/prisma.module';
import { parseArgs } from 'util';
import { NestFactory } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { createAuth } from '../lib/auth';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(__dirname, '../../.env'),
        resolve(__dirname, '../../../../.env'),
      ],
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
      password: { type: 'string' },
      admin: { type: 'boolean' },
    },
  });

  const email = values.email?.trim().toLowerCase();
  const firstname = values.firstname?.trim();
  const lastname = values.lastname?.trim();
  const admin = values.admin ?? false;
  const password = values.password;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('--email doit être une adresse valide');
  }

  if (!firstname || !lastname) {
    throw new Error('--firstname et --lastname sont requis');
  }

  if (!password) {
    throw new Error('--password est requis');
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

    const auth = createAuth(prisma, app.get(ConfigService), {
      provisionUsers: true,
    });

    const body = {
      email,
      name: buildUserName(firstname, lastname),
      firstname,
      lastname,
      password,
      isAdmin: admin,
    };
    const { user } = await auth.api.signUpEmail({ body });

    console.log(`Utilisateur créé : ${user.email}`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
