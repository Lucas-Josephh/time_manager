import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { AuthRequest } from '../auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    request.session = await this.auth.getSession(request.headers);

    // Check if the user has changed the password if necessary, if that is not the case forbidden the access
    if (request.session.user.mustChangePassword)
      throw new ForbiddenException('password_change_required');

    return true;
  }
}
