import { buildUserName } from '../../user/user-name';
import type { AuthHookContext } from '../types/auth-hook-context';

export function provisionUserHook(ctx: AuthHookContext) {
  // Provisioning keeps Better Auth's required name in sync with the source fields.
  if (
    ctx.path === '/sign-up/email' &&
    typeof ctx.body?.firstname === 'string' &&
    typeof ctx.body?.lastname === 'string'
  ) {
    ctx.body.name = buildUserName(ctx.body.firstname, ctx.body.lastname);
  }
}
