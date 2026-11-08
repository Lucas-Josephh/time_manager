import type { ValidationError } from 'class-validator';
import { formatValidationErrors } from './format-validation-errors';
import { ValidationException } from './validation.exception';
import { fieldErrorsResponse } from './field-errors';

const error = (
  property: string,
  constraints?: Record<string, string>,
  children?: ValidationError[],
): ValidationError => ({ property, constraints, children });

describe('Input name error format', () => {
  it('indexes simple fields and preserves validation priorities', () => {
    expect(
      formatValidationErrors([
        error('name', { isString: '', isNotEmpty: '' }),
        error('email', { isEmail: '' }),
      ]),
    ).toEqual({
      name: { messages: ['is_required'] },
      email: { messages: ['invalid_email'] },
    });
  });

  it('uses brackets for every nested key and array index', () => {
    expect(
      formatValidationErrors([
        error('weeklySchedule', undefined, [
          error('1', undefined, [
            error('0', undefined, [error('startTime', { isString: '' })]),
          ]),
        ]),
        error('userIds', undefined, [error('2', { referenceExists: '' })]),
      ]),
    ).toEqual({
      'weeklySchedule[1][0][startTime]': { messages: ['need_string'] },
      'userIds[2]': { messages: ['reference_not_found'] },
    });
  });

  it('keeps group errors alongside errors on individual inputs', () => {
    expect(
      formatValidationErrors([
        error('userIds', { arrayUnique: '' }, [error('0', { isString: '' })]),
      ]),
    ).toEqual({
      userIds: { messages: ['validation_duplicate_array_value'] },
      'userIds[0]': { messages: ['need_string'] },
    });
  });

  it('uses detailed paths supplied by a custom validator context', () => {
    const result = formatValidationErrors([{
      ...error('week', { customWeek: 'invalid' }), value: {},
      contexts: { customWeek: { fieldErrors: (_value: unknown, field: string) => ({
        [`${field}[1][0][endTime]`]: { messages: ['invalid_duration'] },
      }) } },
    }]);
    expect(result).toEqual({ 'week[1][0][endTime]': { messages: ['invalid_duration'] } });
    expect(result).not.toHaveProperty('week');
  });

  it('does not expose rejected values or alter the object prototype', () => {
    const result = formatValidationErrors([
      { ...error('__proto__', { whitelistValidation: '' }), value: 'secret' },
    ]);
    expect(Object.hasOwn(result, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('shares the envelope with business checks and preserves extra conflict details', () => {
    const errors = { 'userIds[2]': { messages: ['outside_management_scope'] } };
    expect(
      fieldErrorsResponse('schedule_assignment_forbidden', errors, {
        conflicts: [],
      }),
    ).toEqual({
      message: 'schedule_assignment_forbidden',
      data: { conflicts: [], errors },
    });
    expect(
      ValidationException.forField('name', 'already_exists').getResponse(),
    ).toEqual({
      message: 'validation_failed',
      data: { errors: { name: { messages: ['already_exists'] } } },
    });
  });
});
