import { APIError } from 'better-auth/api';
import {
  PASSWORD_REQUIREMENTS_REGEX,
  PASSWORD_REQUIREMENTS_CODE,
} from '../../common/validation/password.decorator';
import type { AuthTypes } from '../auth.types';

/**
 * Validates the password in the request body for specific authentication paths.
 * Throws an APIError if the password does not meet the defined requirements.
 *
 * @param ctx
 */
export async function validatePasswordHook(ctx: AuthTypes) {
  if (!['/sign-up/email', '/change-password', '/reset-password'].includes(ctx.path)) {
    return;
  }

  const password =
    ctx.path === '/sign-up/email'
      ? ctx.body?.password
      : ctx.body?.newPassword;

  // Let Better Auth validate missing fields and invalid types.
  if (typeof password !== 'string') return;

  if (!PASSWORD_REQUIREMENTS_REGEX.test(password)) {
    throw new APIError('BAD_REQUEST', {
      code: PASSWORD_REQUIREMENTS_CODE,
      message: PASSWORD_REQUIREMENTS_CODE,
    });
  }
}
