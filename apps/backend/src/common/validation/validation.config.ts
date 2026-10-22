import type { ValidationPipeOptions } from '@nestjs/common';
import { validationExceptionFactory } from './validation-exception.factory';

// Shared configuration for the standard Nest ValidationPipe.
export const validationOptions: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  exceptionFactory: validationExceptionFactory,
};
