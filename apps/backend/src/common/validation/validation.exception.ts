import { BadRequestException } from '@nestjs/common';
import type { FieldError } from './format-validation-errors';

/** Shared error envelope for DTO validation and explicit business checks. */
export class ValidationException extends BadRequestException {
  constructor(errors: FieldError[]) {
    super({
      message: 'validation_failed',
      data: { errors },
    });
  }

  static forField(field: string, code: string): ValidationException {
    return new ValidationException([{ field, messages: [code] }]);
  }
}
