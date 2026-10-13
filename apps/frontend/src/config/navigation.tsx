export const tabs = {
  dashboard: {
    labelKey: 'dashboard',
    href: '/',
  },
  timeClock: {
    labelKey: 'timeClock',
    href: '/clock',
  },
  timesheet: {
    labelKey: 'timesheet',
    href: '/timesheet',
  },
  schedule: {
    labelKey: 'schedule',
    href: '/schedule',
  },
  teams: {
    labelKey: 'teams',
    href: '/teams',
  },
  employees: {
    labelKey: 'employees',
    href: '/employees',
  },
  requests: {
    labelKey: 'requests',
    href: '/requests',
  },
  reports: {
    labelKey: 'reports',
    href: '/reports',
  },
} as const;

export type TabId = keyof typeof tabs;