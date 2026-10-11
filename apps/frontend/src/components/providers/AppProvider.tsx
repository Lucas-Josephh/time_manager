'use client';

import { App, ConfigProvider } from 'antd';
import type { ReactNode } from 'react';

export default function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        components: {
          Notification: {
            width: 360,
            borderRadiusLG: 12,
          },
        },
      }}
    >
      <App
        notification={{ placement: 'topRight' }}
        style={{
          fontFamily: 'inherit',
          color: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
        }}
      >
        {children}
      </App>
    </ConfigProvider>
  );
}
