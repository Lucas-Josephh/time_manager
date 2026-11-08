import { BadRequestException } from '@nestjs/common';
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

function getSlotInterval(slot: Slot): Interval | null {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);

  if (end <= start) {
    return null;
  }

  return { start, end };
}

function hasOverlappingSlots(intervals: Interval[]): boolean {
  intervals.sort((first, second) => first.start - second.start);

  for (let index = 1; index < intervals.length; index++) {
    const previous = intervals[index - 1];
    const current = intervals[index];

    if (current.start < previous.end) {
      return true;
    }
  }

  return false;
}

export function isValidWeek(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  for (let day = 1; day <= 7; day++) {
    const slots = value[String(day)];

    if (!Array.isArray(slots)) {
      return false;
    }

    const intervals: Interval[] = [];

    for (const slot of slots) {
      if (!isValidSlot(slot)) {
        return false;
      }

      const interval = getSlotInterval(slot);

      if (interval === null) {
        return false;
      }

      intervals.push(interval);
    }

    if (hasOverlappingSlots(intervals)) {
      return false;
    }
  }

  return true;
}

export function assertValidSchedule(week: unknown, timezone: unknown): void {
  if (!isValidTimezone(timezone))
    throw new BadRequestException('invalid_schedule_timezone');
  if (!isValidWeek(week))
    throw new BadRequestException('invalid_schedule_slots');
}
