import { FieldErrorsBuilder } from './field-errors.builder';
import type { FieldErrors } from './format-validation-errors';

/** Reuse DTO field errors while preserving each business error's HTTP status. */
export function fieldErrorsResponse(
  message: string,
  errors: FieldErrors | FieldErrorsBuilder,
  details: Record<string, unknown> = {},
) {
  return {
    message,
    data: {
      ...details,
      errors: errors instanceof FieldErrorsBuilder ? errors.toObject() : errors,
    },
  };
}
