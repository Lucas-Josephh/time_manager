import { FieldErrorsBuilder } from './field-errors.builder';
import { fieldErrorsResponse } from './field-errors';
import { ValidationException } from './validation.exception';

describe('Field error responses', () => {
  it('accepts a builder and snapshots its messages without exposing mutable state', () => {
    const builder = new FieldErrorsBuilder();
    builder.at('userIds', 2).add('outside_management_scope');
    const response = fieldErrorsResponse(
      'schedule_assignment_forbidden',
      builder,
      { conflicts: [] },
    );
    builder.at('userIds', 2).add('another_error');
    expect(response).toEqual({
      message: 'schedule_assignment_forbidden',
      data: {
        conflicts: [],
        errors: { 'userIds[2]': { messages: ['outside_management_scope'] } },
      },
    });
    expect(JSON.stringify(response)).not.toContain('fields');
  });

  it('preserves the existing object format and supports builders in validation exceptions', () => {
    const errors = { name: { messages: ['is_required'] } };
    expect(fieldErrorsResponse('validation_failed', errors)).toEqual({
      message: 'validation_failed',
      data: { errors },
    });
    const exception = new ValidationException(
      new FieldErrorsBuilder().add('name', 'is_required'),
    );
    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual(
      fieldErrorsResponse('validation_failed', errors),
    );
  });
});
