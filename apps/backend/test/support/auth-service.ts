import { AuthService } from '../../src/auth/auth.service';

/** Exercise real permission checks without initializing the authentication server. */
export function createTestAuthService(prisma: object): AuthService {
  return Object.assign(Object.create(AuthService.prototype) as AuthService, { prisma });
}
