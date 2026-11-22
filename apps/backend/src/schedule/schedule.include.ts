import type { Prisma } from '../generated/prisma/client';

export const scheduleDetails = {
  createdBy: { select: { id: true, firstname: true, lastname: true } },
  days: {
    orderBy: { dayOfWeek: 'asc' },
    include: { timeSlots: { orderBy: { startTime: 'asc' } } },
  },
} satisfies Prisma.WorkScheduleInclude;
