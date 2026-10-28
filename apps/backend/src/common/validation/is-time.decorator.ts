import { Matches, type ValidationOptions } from 'class-validator';
import { TIME_PATTERN } from './time.pattern';

export function IsTime(validationOptions?: ValidationOptions) {
  return Matches(TIME_PATTERN, validationOptions);
}
