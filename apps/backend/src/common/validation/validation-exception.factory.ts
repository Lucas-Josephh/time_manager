import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

const VALIDATION_CODES: Readonly<Record<string, string>> = {
  isUnique: 'already_exists',
  isString: 'need_string',
  isNotEmpty: 'is_required',
  isDefined: 'is_required',
  maxLength: 'max_length_exceeded',
  minLength: 'min_length_not_reached',
  isEmail: 'invalid_email',
  isInt: 'invalid_integer',
  isNumber: 'invalid_number',
  isBoolean: 'invalid_boolean',
  isDateString: 'invalid_date_string',
  isEnum: 'invalid_enum_value',
  referenceExists: 'reference_not_found',
  whitelistValidation: 'validation_unknown_field',
};

// Une seule erreur par champ, indépendante de l'ordre des décorateurs.
const RULE_PRIORITY = ['isNotEmpty', 'isDefined', 'isString'];

function formatErrors(
  errors: ValidationError[],
  parent = '',
): { field: string; messages: string[] }[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const rules = Object.keys(error.constraints ?? {});
    const rule = RULE_PRIORITY.find((candidate) => rules.includes(candidate)) ?? rules[0];
    const messages = rule ? [VALIDATION_CODES[rule] ?? 'validation_invalid'] : [];

    return [
      ...(messages.length ? [{ field, messages }] : []),
      ...formatErrors(error.children ?? [], field),
    ];
  });
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    message: 'validation_failed',
    data: { errors: formatErrors(errors) },
  });
}
