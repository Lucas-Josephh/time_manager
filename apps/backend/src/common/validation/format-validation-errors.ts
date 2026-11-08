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
  isScheduleTimezone: 'invalid_schedule_timezone',
  isValidScheduleWeek: 'invalid_schedule_slots',
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

export type FieldErrors = Record<string, { messages: string[] }>;

/** Format nested validation errors using the corresponding HTML input names. */
export function formatValidationErrors(
  errors: ValidationError[],
  parent = '',
): FieldErrors {
  const fields = new Map<string, { messages: string[] }>();

  function visit(items: ValidationError[], prefix: string) {
    for (const error of items) {
      const field = prefix ? `${prefix}[${error.property}]` : error.property;
      const code = getErrorCode(error);
      if (code) {
        const rules = Object.keys(error.constraints ?? {});
        const rule =
          RULE_PRIORITY.find((candidate) => rules.includes(candidate)) ??
          rules[0];
        const formatter = error.contexts?.[rule]?.fieldErrors as
          ((value: unknown, field: string) => FieldErrors) | undefined;
        if (typeof formatter === 'function') {
          for (const [name, details] of Object.entries(
            formatter(error.value, field),
          )) {
            fields.set(name, details);
          }
        } else {
          fields.set(field, { messages: [code] });
        }
      }
      visit(error.children ?? [], field);
    }
  }

  visit(errors, parent);
  return Object.fromEntries(fields);
}
