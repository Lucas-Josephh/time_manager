import type { createAuthMiddleware } from 'better-auth/api';

/** Use Better Auth's middleware context without redefining its properties. */
export type AuthHookContext = Parameters<
  Parameters<typeof createAuthMiddleware>[0]
>[0];
