import type { createAuthMiddleware } from 'better-auth/api';
import type { IncomingHttpHeaders } from 'node:http';
import { AuthService } from './auth.service';

/**
 *  Use Better Auth's middleware context without redefining its properties.
 */
export type AuthTypes = Parameters<
  Parameters<typeof createAuthMiddleware>[0]
>[0];

/**
 * Represents an HTTP request with authentication information.
 */
export type AuthRequest = {
  headers: IncomingHttpHeaders;
  session?: Awaited<ReturnType<AuthService['getSession']>>;
};
