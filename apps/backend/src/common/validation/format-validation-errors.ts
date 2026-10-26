import type { ValidationError } from 'class-validator';

const VALIDATION_CODES: Readonly<Record<string, string>> = {
  isPassword: 'password_requirements_not_met',
  isUnique: 'already_exists',
  isString: 'need_string',
  isNotEmpty: 'is_required',
  isDefined: 'is_required',
  maxLength: 'max_length_exceeded',
  minLength: 'min_length_not_reached',
  isEmail: 'invalid_email',
  isPhoneNumber: 'invalid_phone_number',
  isInt: 'invalid_integer',
  isNumber: 'invalid_number',
  isBoolean: 'invalid_boolean',
  isDateString: 'invalid_date_string',
  isEnum: 'invalid_enum_value',
  referenceExists: 'reference_not_found',
  whitelistValidation: 'validation_unknown_field',
  arrayUnique: 'validation_duplicate_array_value',
};

// Define the priority of validation rules to determine which error code to return first.
const RULE_PRIORITY = ['isNotEmpty', 'isDefined', 'isString'];

/**
 * Return the most relevant error code for a given validation error based on the defined priority.
 *
 * @param error
 */
function getErrorCode(error: ValidationError): string | undefined {
  const rules = Object.keys(error.constraints ?? {});
  const priorityRule = RULE_PRIORITY.find((rule) => rules.includes(rule));
  const rule = priorityRule ?? rules[0];
  if (!rule) return undefined;

  return VALIDATION_CODES[rule] ?? 'validation_invalid';
}

export type FieldError = { field: string; messages: string[] };

/**
 * Recursively formats validation errors into a flat array of field errors.
 *
 * @param errors
 * @param parent
 */
export function formatValidationErrors(
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

    const childErrors = formatValidationErrors(error.children ?? [], field);
    result.push(...childErrors);
  }

  return result;
}
