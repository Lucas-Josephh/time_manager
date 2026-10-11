'use client';

import { App } from 'antd';
import type { ReactNode } from 'react';

type NotificationType = 'success' | 'info' | 'warning' | 'error';

type NotificationContent = {
  title: ReactNode;
  description: ReactNode;
};

export default function useAppNotification() {
  const { notification } = App.useApp();

  const notify = (
    type: NotificationType,
    { title, description }: NotificationContent,
  ) => {
    notification[type]({
      title,
      description,
      duration: 4,
      style: {
        borderRadius: 12,
        border: '1px solid var(--color-border)',
      },
    });
  };

  return { notify };
}