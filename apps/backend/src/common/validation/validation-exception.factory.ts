import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

const VALIDATION_CODES: Readonly<Record<string, string>> = {
  validOrganizationParent: 'organization_cycle',
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

type FieldError = { field: string; messages: string[] };

function getErrorCode(error: ValidationError): string | undefined {
  const rules = Object.keys(error.constraints ?? {});
  const priorityRule = RULE_PRIORITY.find((rule) => rules.includes(rule));
  const rule = priorityRule ?? rules[0];
  if (!rule) return undefined;
  return VALIDATION_CODES[rule] ?? 'validation_invalid';
}

function formatErrors(
  errors: ValidationError[],
  parent = '',
): FieldError[] {
  const result: FieldError[] = [];

  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const code = getErrorCode(error);
    if (code) {
      result.push({ field, messages: [code] });
    }

    const childErrors = formatErrors(error.children ?? [], field);
    result.push(...childErrors);
  }

  return result;
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    message: 'validation_failed',
    data: { errors: formatErrors(errors) },
  });
}
