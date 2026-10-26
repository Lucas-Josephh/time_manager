import { APIError } from 'better-auth/api';
import type { AuthTypes } from '../auth.types';

/**
 * This hook is triggered after a user successfully changes their password. It updates
 * the user's record to indicate that they no longer need to change their password.
 *
 * @param ctx
 */
export async function passwordChangedHook(ctx: AuthTypes) {
  if (
    ctx.path !== '/change-password' ||
    !ctx.context.session ||
    ctx.context.returned instanceof APIError
  )
    return;

  // Update the user's record to indicate that they no longer need to change their password.
  await ctx.context.internalAdapter.updateUser(ctx.context.session.user.id, {
    mustChangePassword: false,
  });
}
