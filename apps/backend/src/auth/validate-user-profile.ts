import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { APIError } from 'better-auth/api';
import { validatorOptions } from '../common/validation/validation.config';
import { formatValidationErrors } from '../common/validation/validation-exception.factory';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** Validate and normalize the native endpoint's body before Better Auth writes it. */
export async function validateUserProfile(
  body: unknown,
): Promise<Partial<UpdateProfileDto>> {
  // The native auth routes bypass Nest's exception filter; use Better Auth's error type.
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new APIError('BAD_REQUEST', {
      code: 'BODY_MUST_BE_AN_OBJECT',
      message: 'body_must_be_an_object',
    });
  }

  // The DTO accepts firstname and lastname directly; name is server-derived.
  const profile = plainToInstance(UpdateProfileDto, body);

  // Validate the DTO instance and collect any validation errors.
  const validationErrors = await validate(profile, validatorOptions);

  const errors = formatValidationErrors(validationErrors);

  if (errors.length > 0) {
    // Native auth routes bypass Nest's exception filter; use Better Auth's error type.
    throw new APIError('BAD_REQUEST', {
      code: 'VALIDATION_FAILED',
      message: 'validation_failed',
      data: { errors },
    });
  }

  // Preserve partial updates and nullable values without maintaining a field list.
  return Object.fromEntries(
    Object.entries(profile).filter(([, value]) => value !== undefined),
  );
}
