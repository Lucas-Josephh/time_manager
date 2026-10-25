import { AuthService } from '../auth.service';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthRequest } from '../auth.types';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Fetch the request
    const request = context.switchToHttp().getRequest<AuthRequest>();

    // Fetch the user id if a session is passed
    const id = request.session?.user.id;

    if (!id || !(await this.authService.isAdmin(id)))
      throw new ForbiddenException();

    return true;
  }
}
