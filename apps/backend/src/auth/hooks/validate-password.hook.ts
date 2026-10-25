import { APIError } from 'better-auth/api';
import {
  PASSWORD_REQUIREMENTS_REGEX,
  PASSWORD_REQUIREMENTS_CODE,
} from '../../common/decorator/password.decorator';
import type { AuthHookContext } from '../types/auth-hook-context';

export async function validatePasswordHook(ctx: AuthHookContext) {
  if (!['/sign-up/email', '/reset-password'].includes(ctx.path)) {
    return;
  }

  const password =
    ctx.path === '/sign-up/email'
      ? ctx.body?.password
      : ctx.body?.newPassword;

  if (
    typeof password !== 'string' ||
    !PASSWORD_REQUIREMENTS_REGEX.test(password)
  ) {
    throw new APIError('BAD_REQUEST', {
      code: PASSWORD_REQUIREMENTS_CODE,
      message: PASSWORD_REQUIREMENTS_CODE,
    });
  }
}
