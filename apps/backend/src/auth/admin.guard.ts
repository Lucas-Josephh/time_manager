import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthRequest } from './auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Fetch the request
    const request = context.switchToHttp().getRequest<AuthRequest>();

    // Fetch the user id if a session is passed
    const id = request.session?.user.id;

    // If the user_id is fetched and not empty get the user for check if an administrator
    const user = id
      ? await this.prisma.user.findUnique({
          where: { id },
          select: { isAdmin: true },
        })
      : null;

    // If the user is not found with query, or is not an administrator throw a Forbidden Exception
    if (!user?.isAdmin)
      throw new ForbiddenException();
    return true;
  }
}
