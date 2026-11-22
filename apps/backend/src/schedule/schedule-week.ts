import { DayOfWeek } from '../generated/prisma/enums';

/** Prisma defines the weekday names and their Monday-to-Sunday order. */
export const SCHEDULE_DAYS: readonly DayOfWeek[] = Object.values(DayOfWeek);

export function createEmptyWeek<T>(): Record<DayOfWeek, T[]> {
  return Object.fromEntries(
    SCHEDULE_DAYS.map((day): [DayOfWeek, T[]] => [day, []]),
  ) as Record<DayOfWeek, T[]>;
}
