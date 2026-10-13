import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(__dirname, '../..'),
  async rewrites() {
    return process.env.NODE_ENV === 'development'
      ? [
          {
            source: '/api/auth/:path*',
            destination: 'http://localhost:3001/api/auth/:path*',
          },
        ]
      : [];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);