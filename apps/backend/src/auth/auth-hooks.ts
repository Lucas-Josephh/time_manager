import { createAuthMiddleware } from 'better-auth/api';
import { updateProfileHook } from './hooks/update-profile.hook';
import { provisionUserHook } from './hooks/provision-user.hook';
import { validatePasswordHook } from './hooks/validate-password.hook';
import { passwordChangedHook } from './hooks/password-changed.hook';

/** Keep the execution order explicit for public and provisioning instances. */
export function createAuthHooks() {
  return {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/update-user')
        return updateProfileHook(ctx);

      provisionUserHook(ctx);
      await validatePasswordHook(ctx);
    }),
    after: createAuthMiddleware(passwordChangedHook),
  };
}
