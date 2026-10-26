import { UserAuthorizationService } from './user-authorization.service';
import { UserProvisioningService } from './user-provisioning.service';
import { paginate } from '../../common/pagination/paginate';
import { buildUserName } from '../utils/build-user-name';
import { Injectable } from '@nestjs/common';
import { TeamService } from '../../team/services/team.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, QueryUserDto, UpdateUserDto } from '../dto/user.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: UserAuthorizationService,
    private readonly provisioning: UserProvisioningService,
    private readonly teamService: TeamService,
  ) {}

  /**
   * Authorize and create the account, credentials and optional team membership in one transaction.
   *
   * @param dto - Initial profile, credentials and optional team.
   * @param actor - ID of the administrator performing the operation.
   */
  async create(dto: CreateUserDto, actor: string) {
    // Credentials and profile must either both be persisted or both rolled back.
    return (
      this.prisma
        .$transaction(
          async (tx) => {
            // Recheck administrative rights inside the transaction before provisioning anything.
            await this.authorization.assertCanCreate(actor, tx);

            // When a team is provided, derive the initial organization from that team.
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

            // Share this transaction with Better Auth so credentials and profile commit together.
            return this.provisioning.create(tx, dto, membership);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        )
        // Interpret duplicate-account errors only after the transaction has rolled back.
        .catch((error: unknown) =>
          this.provisioning.rethrowCreationError(error, dto.email),
        )
    );
  }

  /**
   * Return an existing user profile after checking administrative access.
   *
   * @param id - ID of the requested user.
   * @param actor - ID of the administrator performing the operation.
   */
  async findOne(id: string, actor: string) {
    // Protect direct service calls as well as requests passing through AdminGuard.
    await this.authorization.assertCanRead(actor);
    return this.prisma.user.findUniqueOrThrow({ where: { id } });
  }

  /**
   * Return filtered, paginated user profiles with a consistent count and stable ordering.
   *
   * @param query - Search filters and pagination options.
   * @param actor - ID of the administrator performing the operation.
   */
  async findAll(query: QueryUserDto, actor: string) {
    // Protect direct service calls as well as requests passing through AdminGuard.
    await this.authorization.assertCanRead(actor);

    // Combine the supplied search fields using case-insensitive matching.
    const where: Prisma.UserWhereInput = {};
    for (const field of ['email', 'firstname', 'lastname'] as const) {
      if (query[field])
        where[field] = { contains: query[field], mode: 'insensitive' };
    }

    // Read the page and its total from the same snapshot, with an ID tie-breaker for stable ordering.
    return paginate(query, (range) =>
      this.prisma.$transaction(
        [
          this.prisma.user.findMany({
            where,
            skip: range.skip,
            take: range.take,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          }),
          this.prisma.user.count({ where }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }

  /**
   * Authorize and update the profile atomically, rebuilding the name and resetting email verification when needed.
   *
   * @param id - ID of the user to update.
   * @param dto - Profile fields to change; omitted fields are preserved.
   * @param actor - ID of the administrator performing the operation.
   */
  async update(id: string, dto: UpdateUserDto, actor: string) {
    // Include only supplied fields; explicit null and false values must still be applied.
    const data: Prisma.UserUpdateInput = {};
    if (dto.firstname !== undefined) data.firstname = dto.firstname;
    if (dto.lastname !== undefined) data.lastname = dto.lastname;
    if (dto.job !== undefined) data.job = dto.job;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.isAdmin !== undefined) data.isAdmin = dto.isAdmin;
    // A supplied email must be verified again, even when other profile fields are unchanged.
    if (dto.email !== undefined) {
      data.email = dto.email;
      data.emailVerified = false;
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Check current permissions and load the existing name within the write transaction.
        await this.authorization.assertCanUpdate(actor, tx);
        const user = await tx.user.findUniqueOrThrow({
          where: { id },
          select: { firstname: true, lastname: true },
        });
        // Rebuild the display name using stored values for any omitted name field.
        if (dto.firstname !== undefined || dto.lastname !== undefined) {
          data.name = buildUserName(
            dto.firstname ?? user.firstname,
            dto.lastname ?? user.lastname,
          );
        }

        return tx.user.update({ where: { id }, data });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Authorize and delete a user within a Serializable transaction.
   *
   * @param id - ID of the user to delete.
   * @param actor - ID of the administrator performing the operation.
   */
  delete(id: string, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // Authorize deletion using the same transaction that performs it.
        await this.authorization.assertCanDelete(actor, tx);
        return tx.user.delete({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
