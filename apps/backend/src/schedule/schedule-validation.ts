import { SCHEDULE_DAYS } from './schedule-week';
import { FieldErrorsBuilder } from '../common/validation/field-errors.builder';
import { ValidationException } from '../common/validation/validation.exception';
import type { FieldErrors } from '../common/validation/format-validation-errors';
import { TIME_PATTERN } from '../common/validation/time.pattern';

type Slot = { startTime: string; endTime: string };

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

type Interval = { start: number; end: number };

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidSlot(value: unknown): value is Slot {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.startTime !== 'string' ||
    typeof value.endTime !== 'string'
  ) {
    return false;
  }

  if (
    !TIME_PATTERN.test(value.startTime) ||
    !TIME_PATTERN.test(value.endTime)
  ) {
    return false;
  }

  return true;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

/** Collect precise input names while preserving the submitted slot order. */
export function getScheduleWeekErrors(
  value: unknown,
  field = 'weeklySchedule',
): FieldErrors {
  const errors = new FieldErrorsBuilder();
  if (!isObject(value))
    return errors.add(field, 'invalid_schedule_slots').toObject();

  for (const day of SCHEDULE_DAYS) {
    const slots = value[day];
    if (!Array.isArray(slots)) {
      errors.at(field, day).add('invalid_schedule_slots');
      continue;
    }
    const intervals: (Interval & { index: number })[] = [];
    for (const [index, slot] of slots.entries()) {
      if (!isValidSlot(slot)) {
        errors.at(field, day, index).add('invalid_schedule_slots');
        continue;
      }
      const start = timeToMinutes(slot.startTime);
      const end = timeToMinutes(slot.endTime);
      if (end <= start) {
        errors
          .at(field, day, index, 'endTime')
          .add('schedule_end_time_must_follow_start_time');
        continue;
      }
      intervals.push({ start, end, index });
    }

    // Keep original indexes when sorting, including overlaps with a containing slot.
    intervals.sort((first, second) => first.start - second.start);
    let furthest: (typeof intervals)[number] | undefined;
    for (const interval of intervals) {
      if (furthest && interval.start < furthest.end) {
        for (const index of [furthest.index, interval.index]) {
          errors
            .at(field, day, index, 'startTime')
            .add('schedule_slots_overlap');
        }
      }
      if (!furthest || interval.end > furthest.end) furthest = interval;
    }
  }
  return errors.toObject();
}

export function isValidWeek(value: unknown): boolean {
  return Object.keys(getScheduleWeekErrors(value)).length === 0;
}

export function assertValidSchedule(week: unknown, timezone: unknown): void {
  if (!isValidTimezone(timezone))
    throw ValidationException.forField('timezone', 'invalid_schedule_timezone');
  const errors = getScheduleWeekErrors(week);
  if (Object.keys(errors).length) throw new ValidationException(errors);
}
