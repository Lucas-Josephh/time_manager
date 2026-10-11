'use client';

import { StyleProvider } from '@ant-design/cssinjs';
import { App, ConfigProvider } from 'antd';
import type { ReactNode } from 'react';

export default function AppProvider({ children }: { children: ReactNode }) {
  return (
    <StyleProvider layer>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#2878d0',
            colorText: '#163250',
            colorBorder: '#e6ebf2',
            fontSize: 15,
            fontFamily: 'inherit',
          },
          components: {
            Modal: {
              borderRadiusLG: 18,
            },
            Notification: {
              width: 400,
              borderRadiusLG: 18,
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
    </StyleProvider>
  );
}
