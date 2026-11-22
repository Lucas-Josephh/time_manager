import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Password requirements:
 * - At least 12 characters long
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one number
 * - Contains at least one special character (non-alphanumeric)
 * - No more than 128 characters long
 */
export const PASSWORD_REQUIREMENTS_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

export const PASSWORD_REQUIREMENTS_CODE = 'PASSWORD_REQUIREMENTS_NOT_MET';

/**
 * Validates that a string meets the password requirements:
 *
 * @param options
 * @constructor
 */
export function IsPassword(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isPassword',
      target: target.constructor,
      propertyName: String(propertyKey),
      options: { message: PASSWORD_REQUIREMENTS_CODE, ...options },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && PASSWORD_REQUIREMENTS_REGEX.test(value);
        },
      },
    });
  };
}
