import type { ValidationPipeOptions } from '@nestjs/common';
import type { ValidationError, ValidatorOptions } from 'class-validator';
import { formatValidationErrors } from './format-validation-errors';
import { ValidationException } from './validation.exception';

// Shared by Nest's ValidationPipe and direct class-validator calls.
export const validatorOptions: ValidatorOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

export const validationOptions: ValidationPipeOptions = {
  ...validatorOptions,
  transform: true,
  exceptionFactory: (errors: ValidationError[]) =>
    new ValidationException(formatValidationErrors(errors)),
};
