import { FieldErrorsBuilder } from './field-errors.builder';

describe('FieldErrorsBuilder', () => {
  it('builds simple and nested input names, including index zero', () => {
    const errors = new FieldErrorsBuilder();
    errors.add('name', 'is_required');
    errors.at('userIds', 0).add('outside_management_scope');
    errors.at('weeklySchedule', 1, 0, 'endTime').add('invalid_duration');
    expect(errors.toObject()).toEqual({
      name: { messages: ['is_required'] },
      'userIds[0]': { messages: ['outside_management_scope'] },
      'weeklySchedule[1][0][endTime]': { messages: ['invalid_duration'] },
    });
  });

  it('accumulates unique messages in insertion order across repeated paths and merges', () => {
    const errors = new FieldErrorsBuilder();
    errors.at('userIds', 2).add('forbidden', 'forbidden');
    errors.merge({ 'userIds[2]': { messages: ['forbidden', 'missing'] } });
    expect(errors.toObject()).toEqual({
      'userIds[2]': { messages: ['forbidden', 'missing'] },
    });
  });

  it('distinguishes an empty collection from fields with errors', () => {
    const errors = new FieldErrorsBuilder();
    errors.add('name');
    expect(errors.hasErrors()).toBe(false);
    expect(errors.toObject()).toEqual({});
    errors.add('name', 'is_required');
    expect(errors.hasErrors()).toBe(true);
  });

  it('returns independent snapshots and protects special property names', () => {
    const errors = new FieldErrorsBuilder().add('__proto__', 'unknown_field');
    const snapshot = errors.toObject();
    snapshot['__proto__'].messages.push('changed');
    errors.add('name', 'missing');
    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
    expect(Object.hasOwn(snapshot, '__proto__')).toBe(true);
    expect(errors.toObject()['__proto__'].messages).toEqual(['unknown_field']);
    expect(snapshot).not.toHaveProperty('name');
  });
});
