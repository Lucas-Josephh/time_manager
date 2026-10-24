import type { ValidationPipeOptions } from '@nestjs/common';
import type { ValidatorOptions } from 'class-validator';
import { validationExceptionFactory } from './validation-exception.factory';

// Shared by Nest's ValidationPipe and direct class-validator calls.
export const validatorOptions: ValidatorOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

export const validationOptions: ValidationPipeOptions = {
  ...validatorOptions,
  transform: true,
  exceptionFactory: validationExceptionFactory,
};
