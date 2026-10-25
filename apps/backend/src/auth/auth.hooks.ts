import { createAuthMiddleware } from 'better-auth/api';
import { updateProfileHook } from './hooks/update-profile.hook';
import { provisionUserHook } from './hooks/provision-user.hook';
import { validatePasswordHook } from './hooks/validate-password.hook';
import { passwordChangedHook } from './hooks/password-changed.hook';

/**
 * Creates authentication hooks for the application.
 * Includes 'before' and 'after' hooks for handling user authentication, profile updates, password validation, and provisioning.
 *
 * @returns An object containing 'before' and 'after' hooks for authentication.
 */
export function betterAuthHooks() {
  return {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/update-user') return updateProfileHook(ctx);

      provisionUserHook(ctx);
      await validatePasswordHook(ctx);
    }),
    after: createAuthMiddleware(passwordChangedHook),
  };
}
