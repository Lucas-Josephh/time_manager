import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { createAuth } from '../lib/auth';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class UserService {
  private readonly auth: ReturnType<typeof createAuth>;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.auth = createAuth(prisma, config, {
      provisionUsers: true
    });
  }

  // POST /api/users (Création d'un utilisateur via Better Auth)
  async createUser(dto: CreateUserDto) {
    const authUser = await this.auth.api.signUpEmail({
      body: {
        email: dto.email,
        password: dto.password,
        name: dto.firstname,
        lastname: dto.lastname,
      },
    });

    if (!authUser) {
      throw new BadRequestException(
        'Failed to create authentication credentials.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { email: dto.email },
      data: {
        mustChangePassword: true,
        teamId: dto.teamId,
      },
    });

    return updatedUser;
  }

  // PATCH /api/users/:id (Mise à jour partielle des détails)
  async updateParamUser(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // Vérifie l'existence

    return this.prisma.user.update({
      where: { id },
      data: {
        firstname: dto.firstname,
        lastname: dto.lastname,
        phone: dto.phone,
        teamId: dto.teamId,
      },
    });
  }

  // GET /api/users (avec pagination et filtres)
  async findAll(query: {
    page?: number;
    limit?: number;
    email?: string;
    username?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (query.email) {
      where.email = { contains: query.email, mode: 'insensitive' };
    }
    if (query.username) {
      where.username = { contains: query.username, mode: 'insensitive' };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET /api/users/:id
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} introuvable`);
    }
    return user;
  }

  // PUT /api/users/:id
  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // Vérifie l'existence

    return this.prisma.user.update({
      where: { id },
      data: {
        firstname: dto.firstname,
        lastname: dto.lastname,
        phone: dto.phone,
        teamId: dto.teamId,
        email: dto.email,
      },
    });
  }

  // DELETE /api/users/:id
  async remove(id: string) {
    await this.findOne(id); // Vérifie l'existence
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
