import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIError } from 'better-auth/api';
import { createAuth } from '../../lib/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { ValidationException } from '../../common/validation/validation.exception';
import { CreateUserDto } from '../dto/user.dto';
import { buildUserName } from '../utils/build-user-name';

@Injectable()
export class UserProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Create Better Auth credentials and return the persisted profile using the caller’s transaction.
   *
   * @param tx - Transaction shared with the business operation; no new transaction is opened.
   * @param dto - Initial profile and credentials.
   * @param membership - Team and organization resolved by the caller.
   */
  async create(
    tx: Prisma.TransactionClient,
    dto: CreateUserDto,
    membership: { teamId?: string; organizationId?: string },
  ) {
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
      throw ValidationException.forField('email', 'already_exists');

    return createdUser;
  }

  /**
   * Translate Better Auth email conflicts into field validation errors; rethrow all other failures.
   * Call only after the creation transaction has rolled back.
   *
   * @param error - Error raised during account creation.
   * @param email - Email used to check for a concurrent duplicate.
   */
  async rethrowCreationError(error: unknown, email: string): Promise<never> {
    // A concurrent insert can pass DTO validation and fail inside Better Auth.
    // Query only after the failed transaction has rolled back.
    if (
      error instanceof APIError &&
      [
        'FAILED_TO_CREATE_USER',
        'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
      ].includes(error.body?.code ?? '')
    ) {
      // Confirm the duplicate on the regular client after rollback; the failed transaction is closed.
      const existing = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existing)
        throw ValidationException.forField('email', 'already_exists');
    }
    // Preserve unrelated errors for the shared exception filter.
    throw error;
  }
}
