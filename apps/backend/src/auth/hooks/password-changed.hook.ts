import { APIError } from 'better-auth/api';
import type { AuthHookContext } from '../types/auth-hook-context';

/**
 * This hook is triggered after a user successfully changes their password. It updates
 * the user's record to indicate that they no longer need to change their password.
 *
 * @param ctx
 */
export async function passwordChangedHook(ctx: AuthHookContext) {
  if (
    ctx.path !== '/change-password' ||
    !ctx.context.session ||
    ctx.context.returned instanceof APIError
  )
    return;

  await ctx.context.internalAdapter.updateUser(ctx.context.session.user.id, {
    mustChangePassword: false,
  });
}
