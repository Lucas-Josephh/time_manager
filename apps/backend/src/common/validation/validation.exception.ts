import { FieldErrorsBuilder } from './field-errors.builder';
import { fieldErrorsResponse } from './field-errors';
import { BadRequestException } from '@nestjs/common';
import type { FieldErrors } from './format-validation-errors';

/** Shared error envelope for DTO validation and explicit business checks. */
export class ValidationException extends BadRequestException {
  constructor(errors: FieldErrors) {
    super(fieldErrorsResponse('validation_failed', errors));
  }

  static forField(field: string, code: string): ValidationException {
    return new ValidationException(
      new FieldErrorsBuilder().add(field, code).toObject(),
    );
  }
}
