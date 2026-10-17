import { registerDecorator, type ValidationOptions } from 'class-validator';

export const PASSWORD_REQUIREMENTS_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

export const PASSWORD_REQUIREMENTS_CODE = 'PASSWORD_REQUIREMENTS_NOT_MET';

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
