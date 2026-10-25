import { paginate } from '../common/pagination/paginate';
import { buildUserName } from './user-name';
import { APIError } from 'better-auth/api';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TeamService } from '../team/team.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, QueryUserDto, UpdateUserDto } from './dto/user.dto';
import { createAuth } from '../lib/auth';
import { Prisma } from '../generated/prisma/client';
import { fieldValidationException } from '../common/validation/validation-exception.factory';
import { requireResource } from '../common/require-resource';
import { requireUnique } from '../common/validation/resource-validation';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly teamService: TeamService,
  ) {}

  async create(dto: CreateUserDto) {
    // Credentials and profile must either both be persisted or both rolled back.
    return this.prisma
      .$transaction(
        async (tx) => {
          const membership: {
            teamId?: string;
            organizationId?: string;
          } =
            dto.teamId === undefined
              ? {}
              : await this.teamService.getProvisioningMembership(
                  tx,
                  dto.teamId,
                );

          // Create a Better Auth instance that uses the same Prisma transaction as the user creation.
          const auth = createAuth(tx as PrismaService, this.config, {
            provisionUsers: true,
          });

          // Create the user in Better Auth, which will also create the corresponding Prisma user record.
          const { user } = await auth.api.signUpEmail({
            body: {
              email: dto.email,
              password: dto.password,
              name: buildUserName(dto.firstname, dto.lastname),
              firstname: dto.firstname,
              lastname: dto.lastname,
              ...(dto.phone == null ? {} : { phone: dto.phone }),
              isAdmin: dto.isAdmin ?? false,
              mustChangePassword: true,
              ...membership,
            },
          });
          // Return the complete Prisma profile, including all three name fields.
          const createdUser = await tx.user.findUnique({
            where: { id: user.id },
          });

          // Better Auth returns a synthetic user for duplicate signup when autoSignIn
          // is disabled. Handle a duplicate arriving after DTO validation as well.
          if (!createdUser)
            throw fieldValidationException('email', 'already_exists');

          return createdUser;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch(async (error: unknown) => {
        // A concurrent insert can pass DTO validation and fail inside Better Auth.
        // Query only after the failed transaction has rolled back.
        if (
          error instanceof APIError &&
          [
            'FAILED_TO_CREATE_USER',
            'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
          ].includes(error.body?.code ?? '')
        ) {
          const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
          });
          if (existing)
            throw fieldValidationException('email', 'already_exists');
        }
        throw error;
      });
  }

  findOne(id: string) {
    return requireResource(this.prisma.user.findUnique({ where: { id } }));
  }

  async findAll(query: QueryUserDto = {}) {
    const where: Prisma.UserWhereInput = {};
    for (const field of ['email', 'firstname', 'lastname'] as const) {
      if (query[field])
        where[field] = { contains: query[field], mode: 'insensitive' };
    }
    return paginate(query, (range) =>
      this.prisma.$transaction(
        [
          this.prisma.user.findMany({
            where,
            ...range,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          }),
          this.prisma.user.count({ where }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }

  async update(id: string, dto: UpdateUserDto) {
    if (dto.email !== undefined) await this.validateEmail(dto.email, id);
    const data = {
      firstname: dto.firstname,
      lastname: dto.lastname,
      email: dto.email,
      phone: dto.phone,
      isAdmin: dto.isAdmin,
      ...(dto.email !== undefined ? { emailVerified: false } : {}),
    };
    if (dto.firstname === undefined && dto.lastname === undefined) {
      return this.prisma.user.update({ where: { id }, data });
    }
    return this.prisma.$transaction(
      async (tx) => {
        const user = await requireResource(
          tx.user.findUnique({
            where: { id },
            select: { firstname: true, lastname: true },
          }),
        );
        return tx.user.update({
          where: { id },
          data: {
            ...data,
            name: buildUserName(
              dto.firstname ?? user.firstname,
              dto.lastname ?? user.lastname,
            ),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  private validateEmail(email: string, id?: string) {
    return requireUnique(
      this.prisma.user.findFirst({
        where: { email, ...(id ? { id: { not: id } } : {}) },
        select: { id: true },
      }),
      'email',
    );
  }
}
