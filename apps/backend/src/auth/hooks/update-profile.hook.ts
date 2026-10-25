import { getSessionFromCtx } from 'better-auth/api';
import { buildUserName } from '../../user/user-name';
import type { AuthHookContext } from '../types/auth-hook-context';

export async function updateProfileHook(ctx: AuthHookContext) {
  const body = ctx.body;
  // Leave malformed input and authentication errors to the native endpoint.
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return;

  if (body.firstname !== undefined && typeof body.firstname !== 'string')
    return;

  if (body.lastname !== undefined && typeof body.lastname !== 'string')
    return;

  if (body.firstname !== undefined || body.lastname !== undefined) {
    const session = await getSessionFromCtx(ctx);

    if (!session)
      return;

    const user = await ctx.context.internalAdapter.findUserById(
      session.user.id,
    );

    if (!user)
      return;

    const currentProfile = user as typeof user & {
      firstname: string;
      lastname: string;
    };

    const name = buildUserName(
      body.firstname ?? currentProfile.firstname,
      body.lastname ?? currentProfile.lastname,
    );

    return { context: { body: { ...body, name } } };
  }
}
