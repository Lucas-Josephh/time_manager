import { buildUserName } from '../../user/utils/build-user-name';
import type { AuthTypes } from '../auth.types';

/**
 * Provisions a user by ensuring that the required name field is synchronized
 * with the source fields (firstname and lastname) during the sign-up process.
 *
 * @param ctx
 */
export function provisionUserHook(ctx: AuthTypes) {
  // Provisioning keeps Better Auth's required name in sync with the source fields.
  if (
    ctx.path === '/sign-up/email' &&
    typeof ctx.body?.firstname === 'string' &&
    typeof ctx.body?.lastname === 'string'
  ) {
    ctx.body.name = buildUserName(ctx.body.firstname, ctx.body.lastname);
  }
}
