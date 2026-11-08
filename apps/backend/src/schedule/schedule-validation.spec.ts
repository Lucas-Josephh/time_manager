import {
  assertValidSchedule,
  getScheduleWeekErrors,
  isValidTimezone,
  isValidWeek,
} from './schedule-validation';

const week = () =>
  ({ '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [] }) as Record<
    string,
    { startTime: string; endTime: string }[]
  >;

describe('Schedule time validation', () => {
  it.each(['Europe/Paris', 'America/New_York', 'UTC'])(
    'accepts zone %s',
    (zone) => expect(isValidTimezone(zone)).toBe(true),
  );
  it.each(['', 'invalid/zone', '+02:00', null])(
    'refuses invalid zone %p',
    (zone) => expect(isValidTimezone(zone)).toBe(false),
  );
  it('accepts adjacent slots and unsorted non-overlapping slots', () => {
    const value = week();
    value['1'] = [
      { startTime: '13:00', endTime: '17:00' },
      { startTime: '09:00', endTime: '13:00' },
    ];
    expect(isValidWeek(value)).toBe(true);
  });
  it.each([
    [{ startTime: '12:00', endTime: '12:00' }],
    [{ startTime: '22:00', endTime: '06:00' }],
    [
      { startTime: '09:00', endTime: '17:00' },
      { startTime: '12:00', endTime: '13:00' },
    ],
  ])('rejects invalid durations and overlaps: %p', (...slots) => {
    const value = week();
    value['1'] = slots;
    expect(isValidWeek(value)).toBe(false);
  });
  it('checks each day independently', () => {
    const value = week();
    value['1'] = [{ startTime: '09:00', endTime: '17:00' }];
    value['2'] = [{ startTime: '09:00', endTime: '17:00' }];
    expect(isValidWeek(value)).toBe(true);
  });
  it('points an invalid duration to the exact endTime input', () => {
    const value = week();
    value['1'] = [{ startTime: '09:00', endTime: '08:00' }];
    expect(getScheduleWeekErrors(value)).toEqual({
      'weeklySchedule[1][0][endTime]': {
        messages: ['schedule_end_time_must_follow_start_time'],
      },
    });
    expect(() => assertValidSchedule(value, 'UTC')).toThrow(
      expect.objectContaining({
        response: {
          message: 'validation_failed',
          data: { errors: getScheduleWeekErrors(value) },
        },
      }),
    );
  });

  it('keeps original indexes and finds every overlap with a containing slot', () => {
    const value = week();
    value['1'] = [
      { startTime: '14:00', endTime: '15:00' },
      { startTime: '09:00', endTime: '17:00' },
      { startTime: '10:00', endTime: '11:00' },
      { startTime: '17:00', endTime: '18:00' },
    ];
    expect(getScheduleWeekErrors(value)).toEqual({
      'weeklySchedule[1][0][startTime]': {
        messages: ['schedule_slots_overlap'],
      },
      'weeklySchedule[1][1][startTime]': {
        messages: ['schedule_slots_overlap'],
      },
      'weeklySchedule[1][2][startTime]': {
        messages: ['schedule_slots_overlap'],
      },
    });
  });

  it('protects direct service calls as well as DTO validation', () => {
    expect(() => assertValidSchedule(week(), 'bogus')).toThrow();
    expect(() => assertValidSchedule({}, 'UTC')).toThrow();
  });
});
