export const tabs = {
  login: {
    labelKey: 'login',
    href: '/login',
  },
  register: {
    labelKey: 'register',
    href: '/register',
  },
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
  teams: {
    labelKey: 'teams',
    href: '/teams',
  },
  employees: {
    labelKey: 'employees',
    href: '/employees',
  },
  reports: {
    labelKey: 'reports',
    href: '/reports',
  },
  settings: {
    labelKey: 'settings',
    href: '/settings',
  },
} as const;

export type TabId = keyof typeof tabs;
